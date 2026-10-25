import {applyMiddleware, legacy_createStore as createStore} from 'redux';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {createHealthConnectMiddleware, HealthConnectMiddlewareDeps, BODY_WEIGHT_LOOKBACK_MS} from '../../../app/redux/HealthConnect/healthConnectMiddleware';
import {HEALTH_CONNECT_ACTIONS, HealthConnectState} from '../../../app/redux/HealthConnect/healthConnectReducer';
import {HealthConnectSessionInput, healthConnectFingerprint, mapTrainingToHealthConnectSession} from '../../../app/utils/healthConnect/healthConnectMapping';
import {HC_PERMISSION, HealthConnectSdkStatus} from '../../../app/utils/healthConnect/healthConnectNative';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';

const NOW = Date.UTC(2026, 9, 24, 12, 0);
const START = Date.UTC(2026, 9, 24, 10, 0);
const ALL_PERMISSIONS = [HC_PERMISSION.READ_EXERCISE, HC_PERMISSION.WRITE_EXERCISE, HC_PERMISSION.READ_WEIGHT];

const fakeHealthConnect = (sdkStatus: HealthConnectSdkStatus = 'AVAILABLE', granted: string[] = ALL_PERMISSIONS) => ({
  getSdkStatus: jest.fn(async () => sdkStatus),
  isProvidedBySystem: jest.fn(async () => true),
  getGrantedPermissions: jest.fn(async () => granted),
  requestPermissions: jest.fn(async (_permissions: string[]) => [HC_PERMISSION.WRITE_EXERCISE]),
  isHistoryReadAvailable: jest.fn(async () => true),
  readWeights: jest.fn(async (_startMs: number, _endMs: number) => [{kg: 82.5, time: NOW - 1000, origin: 'com.withings.wiscale2', originLabel: 'Withings'}]),
  writeStrengthSession: jest.fn(async (_session: HealthConnectSessionInput) => ['record-1']),
  deleteStrengthSession: jest.fn(async (_clientRecordId: string) => true),
  openHealthConnect: jest.fn(async () => true),
  openManagePermissions: jest.fn(async () => true),
});

const startedTraining: Training = {
  id: 1,
  state: TrainingsState.STARTED,
  start: new Date(START),
  exercises: [1],
  doneWorkoutIds: {1: 10},
  plannedWorkouts: {},
};

// `null` = no native module (iOS / a build without Health Connect).
const setup = (healthConnect: Partial<HealthConnectState>, hc: ReturnType<typeof fakeHealthConnect> | null = fakeHealthConnect()) => {
  const initial: GlobalState = rootReducer(undefined, {type: '@@INIT'});
  const preloaded: GlobalState = {
    ...initial,
    exercises: {byId: {1: {id: 1, name: 'Squat'}}, allIds: [1]},
    workouts: {...initial.workouts, byId: {10: {id: 10, exerciseId: 1, sets: [{index: 1, reps: 5, weight: 100, rir: 2}]}}, allIds: [10]},
    trainings: {byId: {1: startedTraining}, allIds: [1]},
    healthConnect: {writeEnabled: true, everConnected: true, written: {}, ...healthConnect},
  };
  const notify = jest.fn();
  let namespaces = 0;
  const deps: HealthConnectMiddlewareDeps = {getModule: () => hc ?? undefined, notify, now: () => NOW, newNamespace: () => `ns${++namespaces}`};
  const store = createStore(rootReducer, preloaded, applyMiddleware(createHealthConnectMiddleware(deps)));
  return {store, hc, notify};
};

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

const finishTraining = {type: 'FINISH_TRAINING', trainingsId: 1, trainingsPlanId: 1, date: NOW};

describe('GH-528 healthConnectMiddleware', () => {
  it('writes a finished training as strength session and remembers it', async () => {
    const {store, hc} = setup({});
    store.dispatch(finishTraining);
    await flush();

    const state = store.getState();
    const session = mapTrainingToHealthConnectSession(state.trainings.byId[1], state.workouts.byId, state.exercises.byId, NOW)!;
    expect(hc!.writeStrengthSession.mock.calls).toEqual([[session]]);
    expect(state.healthConnect).toEqual({
      writeEnabled: true,
      everConnected: true,
      written: {1: healthConnectFingerprint(session)},
      lastSync: {kind: 'written', trainingId: 1, title: 'Gainalytics: Squat', at: NOW},
    });
  });

  it('updates the Health Connect entry when a set of the finished training is edited, and deletes it with the training', async () => {
    const {store, hc} = setup({});
    store.dispatch(finishTraining);
    await flush();
    store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId: 10, set: {index: 1, reps: 5, weight: 110, rir: 2}});
    await flush();

    expect(hc!.writeStrengthSession).toHaveBeenCalledTimes(2);
    expect(hc!.writeStrengthSession.mock.calls[1][0].notes).toBe('Squat: 5 × 110 kg @ RIR 2');

    store.dispatch({type: 'DELETE_TRAINING', trainingsId: 1, trainingsPlanId: 1, micro: 1, trainingInMicro: 1, workoutIds: [10]});
    await flush();

    expect(hc!.deleteStrengthSession.mock.calls).toEqual([['gainalytics-training-1']]);
    expect(store.getState().healthConnect?.written).toEqual({});
    expect(store.getState().healthConnect?.lastSync).toEqual({kind: 'deleted', trainingId: 1, at: NOW});
  });

  it('neither writes nor asks Health Connect anything while writing is switched off', async () => {
    const {store, hc} = setup({writeEnabled: false, everConnected: false});
    store.dispatch(finishTraining);
    store.dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH});
    await flush();

    expect(Object.values(hc!).map((fn) => fn.mock.calls.length)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(store.getState().trainings.byId[1].state).toBe(TrainingsState.FINISHED);
  });

  it.each([
    ['revoked permissions', fakeHealthConnect('AVAILABLE', [HC_PERMISSION.READ_WEIGHT]), 'Gainalytics may no longer write trainings to Health Connect. Connect again in Settings → Health Connect.'],
    ['uninstalled Health Connect', fakeHealthConnect('UNAVAILABLE'), 'Health Connect is not installed.'],
    ['no native module', null, 'Health Connect is not supported on this device.'],
  ])('keeps the training and shows one hint with %s', async (_case, hc, message) => {
    const {store, notify} = setup({}, hc);
    store.dispatch(finishTraining);
    store.dispatch(finishTraining);
    await flush();

    expect(hc?.writeStrengthSession.mock.calls ?? []).toEqual([]);
    expect(store.getState().trainings.byId[1]).toEqual({...startedTraining, state: TrainingsState.FINISHED, end: NOW});
    expect(store.getState().healthConnect?.lastSync).toEqual({kind: 'failed', trainingId: 1, message, at: NOW});
    expect(notify.mock.calls).toEqual([['Not written to Health Connect', `Your training is safe in Gainalytics. ${message}`]]);
  });

  it('keeps the training when the write itself fails', async () => {
    const hc = fakeHealthConnect();
    hc.writeStrengthSession.mockRejectedValueOnce(new Error('SecurityException'));
    const {store} = setup({}, hc);
    store.dispatch(finishTraining);
    await flush();

    expect(store.getState().trainings.byId[1].state).toBe(TrainingsState.FINISHED);
    expect(store.getState().healthConnect?.written).toEqual({});
    expect(store.getState().healthConnect?.lastSync).toEqual({kind: 'failed', trainingId: 1, message: 'SecurityException', at: NOW});
  });

  it('refreshes status and loads body weights when weight may be read', async () => {
    const {store, hc} = setup({});
    store.dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH});
    await flush();

    expect(hc!.readWeights.mock.calls).toEqual([[NOW - BODY_WEIGHT_LOOKBACK_MS, NOW + 60000]]);
    expect(store.getState().healthConnect).toEqual({
      writeEnabled: true,
      everConnected: true,
      written: {},
      status: {sdkStatus: 'AVAILABLE', providedBySystem: true, granted: ALL_PERMISSIONS, historyReadAvailable: true},
      bodyWeights: {weights: [{kg: 82.5, time: NOW - 1000, origin: 'com.withings.wiscale2', originLabel: 'Withings'}], error: undefined, loadedAt: NOW},
    });
  });

  it('drops body weights once the weight permission is revoked', async () => {
    const hc = fakeHealthConnect();
    const {store} = setup({}, hc);
    store.dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH});
    await flush();
    hc.getGrantedPermissions.mockResolvedValue([HC_PERMISSION.WRITE_EXERCISE]);
    store.dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH});
    await flush();

    expect(store.getState().healthConnect?.bodyWeights).toBeUndefined();
  });

  it('connect asks for exactly the feature permissions and then re-reads the full granted set', async () => {
    const {store, hc} = setup({everConnected: false, writeEnabled: false});
    store.dispatch({type: HEALTH_CONNECT_ACTIONS.CONNECT});
    await flush();

    expect(hc!.requestPermissions.mock.calls).toEqual([[ALL_PERMISSIONS]]);
    expect(store.getState().healthConnect?.status).toEqual({sdkStatus: 'AVAILABLE', providedBySystem: true, granted: ALL_PERMISSIONS, historyReadAvailable: true});
    expect(store.getState().healthConnect?.everConnected).toBe(true);
  });

  it('reports a device without Health Connect module as not supported', async () => {
    const {store} = setup({}, null);
    store.dispatch({type: HEALTH_CONNECT_ACTIONS.REFRESH, force: true});
    await flush();

    expect(store.getState().healthConnect?.status).toEqual({sdkStatus: 'NOT_SUPPORTED'});
  });

  describe('Codex review follow-ups', () => {
    // A native write that only finishes when the test says so.
    const slowWrite = (hc: ReturnType<typeof fakeHealthConnect>) => {
      let finish: () => void = () => {};
      hc.writeStrengthSession.mockImplementationOnce(() => new Promise<string[]>((resolve) => (finish = () => resolve(['record-1']))));
      return () => finish();
    };

    it('drops a queued write when writing is switched off before it runs', async () => {
      const hc = fakeHealthConnect();
      const {store} = setup({}, hc);
      store.dispatch({type: HEALTH_CONNECT_ACTIONS.LOAD_WEIGHTS});
      store.dispatch(finishTraining);
      store.dispatch({type: HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED, enabled: false});
      await flush();

      expect(hc.writeStrengthSession.mock.calls).toEqual([]);
      expect(store.getState().healthConnect?.written).toEqual({});
      expect(store.getState().healthConnect?.lastSync).toBeUndefined();
    });

    it('removes a training from Health Connect that was deleted while its first write was still running', async () => {
      const hc = fakeHealthConnect();
      const finishWrite = slowWrite(hc);
      const {store} = setup({}, hc);
      store.dispatch(finishTraining);
      await flush();
      store.dispatch({type: 'DELETE_TRAINING', trainingsId: 1, trainingsPlanId: 1, micro: 1, trainingInMicro: 1, workoutIds: [10]});
      finishWrite();
      await flush();

      expect(hc.writeStrengthSession).toHaveBeenCalledTimes(1);
      expect(hc.deleteStrengthSession.mock.calls).toEqual([['gainalytics-training-1']]);
      expect(store.getState().healthConnect?.written).toEqual({});
      expect(store.getState().healthConnect?.lastSync).toEqual({kind: 'deleted', trainingId: 1, at: NOW});
    });

    it('rewrites a training that was edited while its first write was still running', async () => {
      const hc = fakeHealthConnect();
      const finishWrite = slowWrite(hc);
      const {store} = setup({}, hc);
      store.dispatch(finishTraining);
      await flush();
      store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId: 10, set: {index: 1, reps: 5, weight: 110, rir: 2}});
      finishWrite();
      await flush();

      const state = store.getState();
      const session = mapTrainingToHealthConnectSession(state.trainings.byId[1], state.workouts.byId, state.exercises.byId, NOW)!;
      expect(hc.writeStrengthSession).toHaveBeenCalledTimes(2);
      expect(hc.writeStrengthSession.mock.calls[1]).toEqual([session]);
      expect(state.healthConnect?.written).toEqual({1: healthConnectFingerprint(session)});
    });

    it('starts a record namespace when writing is switched on from scratch, and a new one after restoring a backup', async () => {
      const hc = fakeHealthConnect();
      const {store} = setup({writeEnabled: false}, hc);
      store.dispatch({type: HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED, enabled: true});
      expect(store.getState().healthConnect?.recordNamespace).toBe('ns1');

      store.dispatch(finishTraining);
      await flush();
      expect(hc.writeStrengthSession.mock.calls[0][0].clientRecordId).toBe('gainalytics-ns1-training-1');

      const backup: Partial<GlobalState> = {...store.getState()};
      delete backup.healthConnect;
      store.dispatch({type: 'FULL_IMPORT', state: backup});
      expect(store.getState().healthConnect).toEqual({writeEnabled: true, everConnected: true, written: {}, recordNamespace: 'ns2'});
    });

    it('ignores the result of a write still running when a backup is restored, so the imported training is not exported', async () => {
      const hc = fakeHealthConnect();
      const finishWrite = slowWrite(hc);
      const {store} = setup({}, hc);
      store.dispatch(finishTraining);
      await flush();
      expect(hc.writeStrengthSession).toHaveBeenCalledTimes(1);

      // The backup holds a finished training with the same id 1.
      const backup: Partial<GlobalState> = {...store.getState()};
      delete backup.healthConnect;
      store.dispatch({type: 'FULL_IMPORT', state: backup});
      finishWrite();
      await flush();

      expect(store.getState().healthConnect).toEqual({writeEnabled: true, everConnected: true, written: {}, recordNamespace: 'ns1'});

      // Changing the imported training must not export it.
      store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId: 10, set: {index: 1, reps: 5, weight: 110, rir: 2}});
      await flush();

      expect(hc.writeStrengthSession).toHaveBeenCalledTimes(1);
      expect(hc.deleteStrengthSession.mock.calls).toEqual([]);
      expect(store.getState().healthConnect).toEqual({writeEnabled: true, everConnected: true, written: {}, recordNamespace: 'ns1'});
    });

    it('drops a write of the old dataset still queued when a backup is restored', async () => {
      const hc = fakeHealthConnect();
      const {store, notify} = setup({}, hc);
      store.dispatch({type: HEALTH_CONNECT_ACTIONS.LOAD_WEIGHTS});
      store.dispatch(finishTraining);
      const backup: Partial<GlobalState> = {...store.getState()};
      delete backup.healthConnect;
      store.dispatch({type: 'FULL_IMPORT', state: backup});
      await flush();

      expect(hc.writeStrengthSession.mock.calls).toEqual([]);
      expect(notify.mock.calls).toEqual([]);
      expect(store.getState().healthConnect?.written).toEqual({});
      expect(store.getState().healthConnect?.lastSync).toBeUndefined();
    });

    it('still writes trainings finished after the restore, under the new namespace', async () => {
      const hc = fakeHealthConnect();
      const finishWrite = slowWrite(hc);
      const {store} = setup({}, hc);
      store.dispatch(finishTraining);
      await flush();
      const backup: Partial<GlobalState> = {...store.getState(), trainings: {byId: {1: startedTraining}, allIds: [1]}};
      delete backup.healthConnect;
      store.dispatch({type: 'FULL_IMPORT', state: backup});
      store.dispatch(finishTraining);
      finishWrite();
      await flush();

      const state = store.getState();
      const session = mapTrainingToHealthConnectSession(state.trainings.byId[1], state.workouts.byId, state.exercises.byId, NOW, 'ns1')!;
      expect(hc.writeStrengthSession.mock.calls[1]).toEqual([session]);
      expect(session.clientRecordId).toBe('gainalytics-ns1-training-1');
      expect(state.healthConnect).toEqual({
        writeEnabled: true,
        everConnected: true,
        written: {1: healthConnectFingerprint(session)},
        recordNamespace: 'ns1',
        lastSync: {kind: 'written', trainingId: 1, title: 'Gainalytics: Squat', at: NOW},
      });
    });

    it('keeps the old id format for entries written before namespaces existed', async () => {
      const hc = fakeHealthConnect();
      const {store} = setup({written: {7: 'old'}}, hc);
      store.dispatch({type: HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED, enabled: true});
      store.dispatch(finishTraining);
      await flush();

      expect(store.getState().healthConnect?.recordNamespace).toBeUndefined();
      expect(hc.writeStrengthSession.mock.calls[0][0].clientRecordId).toBe('gainalytics-training-1');
    });
  });
});
