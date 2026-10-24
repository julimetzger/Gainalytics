/**
 * GH-528: all Health Connect side effects. Reducers stay pure; this middleware
 * - executes the HEALTH_CONNECT_* commands (refresh status, connect, load body weights),
 * - writes/deletes trainings as planned by planHealthConnectSync after each action.
 *
 * Every native call checks availability and permissions first and never throws into the
 * dispatch: a failed Health Connect write must never lose or block a Gainalytics training.
 */
import {AnyAction, Dispatch, Middleware} from 'redux';
import Toast from 'react-native-toast-message';
import {GlobalState} from '../rootReducer';
import {HEALTH_CONNECT_ACTIONS, HealthConnectStatus, HealthConnectSyncEvent} from './healthConnectReducer';
import {CONNECT_PERMISSIONS, getHealthConnect, HC_PERMISSION} from '../../utils/healthConnect/healthConnectNative';
import {HealthConnectSyncOp, planHealthConnectSync} from '../../utils/healthConnect/healthConnectSync';

type HealthConnectModule = NonNullable<ReturnType<typeof getHealthConnect>>;

export interface HealthConnectMiddlewareDeps {
  getModule: () => HealthConnectModule | undefined;
  notify: (title: string, text: string) => void;
  now: () => number;
  /** A new, practically unique record-id namespace (see HealthConnectState.recordNamespace). */
  newNamespace?: () => string;
}

const defaultNewNamespace = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** How far back body weights are read; Health Connect itself cuts this to 30 days without the history permission. */
export const BODY_WEIGHT_LOOKBACK_MS = 5 * 365 * 24 * 60 * 60 * 1000;

const defaultDeps: HealthConnectMiddlewareDeps = {
  getModule: getHealthConnect,
  notify: (text1, text2) => Toast.show({type: 'info', text1, text2, position: 'bottom', visibilityTime: 5000}),
  now: () => Date.now(),
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

class HealthConnectUnusable extends Error {}

/** Reads the provider status and — only if available — the granted permissions. */
export const readHealthConnectStatus = async (hc: HealthConnectModule | undefined): Promise<HealthConnectStatus> => {
  if (!hc) return {sdkStatus: 'NOT_SUPPORTED'};
  const [sdkStatus, providedBySystem] = await Promise.all([hc.getSdkStatus(), hc.isProvidedBySystem()]);
  if (sdkStatus !== 'AVAILABLE') return {sdkStatus, providedBySystem};
  const [granted, historyReadAvailable] = await Promise.all([hc.getGrantedPermissions(), hc.isHistoryReadAvailable()]);
  return {sdkStatus, providedBySystem, granted, historyReadAvailable};
};

/** Resolves the module only if Health Connect is available and [permission] is granted right now. */
const requireUsable = async (hc: HealthConnectModule | undefined, permission: string, missingText: string) => {
  if (!hc) throw new HealthConnectUnusable('Health Connect is not supported on this device.');
  const sdkStatus = await hc.getSdkStatus();
  if (sdkStatus === 'PROVIDER_UPDATE_REQUIRED') throw new HealthConnectUnusable('Health Connect needs an update.');
  if (sdkStatus !== 'AVAILABLE') throw new HealthConnectUnusable('Health Connect is not installed.');
  const granted = await hc.getGrantedPermissions();
  if (!granted.includes(permission)) throw new HealthConnectUnusable(missingText);
  return hc;
};

export const createHealthConnectMiddleware = (deps: HealthConnectMiddlewareDeps = defaultDeps): Middleware<{}, GlobalState> => {
  // Ops run one after another, so a write and a later delete of the same training keep their order.
  let queue: Promise<void> = Promise.resolve();
  // Ops queued but not done yet: repeated actions meanwhile must not queue the same op again.
  const pending = new Map<number, string>();
  const pendingKey = (op: HealthConnectSyncOp) => (op.kind === 'write' ? op.fingerprint : 'delete');
  // One hint per training and kind per app session is enough; the settings show the last failure.
  const notified = new Set<string>();

  const refresh = async (dispatch: Dispatch) => {
    try {
      const status = await readHealthConnectStatus(deps.getModule());
      dispatch({type: HEALTH_CONNECT_ACTIONS.STATUS, status});
      if (status.sdkStatus === 'AVAILABLE' && status.granted.includes(HC_PERMISSION.READ_WEIGHT)) {
        dispatch({type: HEALTH_CONNECT_ACTIONS.LOAD_WEIGHTS});
      }
    } catch (error) {
      // Status reads fail e.g. while the provider app is being updated; keep the last known state.
      console.warn('Health Connect status unavailable', errorMessage(error));
    }
  };

  const requestPermissions = async (dispatch: Dispatch, permissions: string[]) => {
    try {
      const hc = deps.getModule();
      if (hc) await hc.requestPermissions(permissions);
    } catch (error) {
      deps.notify('Health Connect', errorMessage(error));
    }
    // The dialog only reports what it granted itself; always re-read the full set.
    await refresh(dispatch);
  };

  const loadWeights = async (dispatch: Dispatch) => {
    const loadedAt = deps.now();
    try {
      const hc = await requireUsable(deps.getModule(), HC_PERMISSION.READ_WEIGHT, 'Gainalytics may not read your body weight.');
      const weights = await hc.readWeights(loadedAt - BODY_WEIGHT_LOOKBACK_MS, loadedAt + 60 * 1000);
      dispatch({type: HEALTH_CONNECT_ACTIONS.WEIGHTS_LOADED, weights, loadedAt});
    } catch (error) {
      dispatch({type: HEALTH_CONNECT_ACTIONS.WEIGHTS_LOADED, weights: [], error: errorMessage(error), loadedAt});
    }
  };

  const runOp = async (op: HealthConnectSyncOp, dispatch: Dispatch, getState: () => GlobalState) => {
    // The opt-in may have been switched off while this op waited in the queue.
    if (!getState().healthConnect?.writeEnabled) {
      if (pending.get(op.trainingId) === pendingKey(op)) pending.delete(op.trainingId);
      return;
    }
    const at = deps.now();
    let event: HealthConnectSyncEvent;
    try {
      const hc = await requireUsable(
        deps.getModule(),
        HC_PERMISSION.WRITE_EXERCISE,
        'Gainalytics may no longer write trainings to Health Connect. Connect again in Settings → Health Connect.',
      );
      if (op.kind === 'write') {
        await hc.writeStrengthSession(op.session);
        event = {kind: 'written', trainingId: op.trainingId, title: op.session.title, at};
      } else {
        await hc.deleteStrengthSession(op.clientRecordId);
        event = {kind: 'deleted', trainingId: op.trainingId, at};
      }
    } catch (error) {
      event = {kind: 'failed', trainingId: op.trainingId, message: errorMessage(error), at};
      const key = `${op.kind}-${op.trainingId}`;
      if (!notified.has(key)) {
        notified.add(key);
        deps.notify(
          op.kind === 'write' ? 'Not written to Health Connect' : 'Not removed from Health Connect',
          `Your training is safe in Gainalytics. ${event.message}`,
        );
      }
    } finally {
      if (pending.get(op.trainingId) === pendingKey(op)) pending.delete(op.trainingId);
    }
    dispatch({type: HEALTH_CONNECT_ACTIONS.SYNC_RESULT, event, fingerprint: op.kind === 'write' ? op.fingerprint : undefined});
  };

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task, task);
  };

  return (api) => (next) => (action: AnyAction) => {
    const prev = api.getState();
    const result = next(action);
    const state = api.getState();

    switch (action.type) {
      case HEALTH_CONNECT_ACTIONS.REFRESH:
        // Without a connection Health Connect is not even asked — except from its settings entry.
        if (action.force === true || state.healthConnect?.everConnected) enqueue(() => refresh(api.dispatch));
        return result;
      case HEALTH_CONNECT_ACTIONS.CONNECT:
        enqueue(() => requestPermissions(api.dispatch, CONNECT_PERMISSIONS));
        return result;
      case HEALTH_CONNECT_ACTIONS.REQUEST_HISTORY:
        enqueue(() => requestPermissions(api.dispatch, [HC_PERMISSION.READ_HISTORY]));
        return result;
      case HEALTH_CONNECT_ACTIONS.LOAD_WEIGHTS:
        enqueue(() => loadWeights(api.dispatch));
        return result;
    }

    const hcState = state.healthConnect;
    if (
      (action.type === HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED || action.type === 'FULL_IMPORT') &&
      hcState?.writeEnabled &&
      !hcState.recordNamespace &&
      Object.keys(hcState.written ?? {}).length === 0
    ) {
      // Writing starts from scratch: training ids may repeat ids of sessions already in Health Connect
      // (older install, restored backup), so new records get their own namespace.
      api.dispatch({type: HEALTH_CONNECT_ACTIONS.NEW_RECORD_NAMESPACE, namespace: (deps.newNamespace ?? defaultNewNamespace)()});
      return result;
    }

    if (hcState?.writeEnabled) {
      planHealthConnectSync(prev, state, action, deps.now(), pending).forEach((op) => {
        const key = pendingKey(op);
        if (pending.get(op.trainingId) === key) return;
        pending.set(op.trainingId, key);
        enqueue(() => runOp(op, api.dispatch, api.getState));
      });
    }
    return result;
  };
};

export const healthConnectMiddleware = createHealthConnectMiddleware();
