import {AnyAction} from 'redux';
import {HC_PERMISSION, HealthConnectSdkStatus, HealthConnectWeight} from '../../utils/healthConnect/healthConnectNative';

/**
 * GH-528: Health Connect state.
 *
 * Persisted (see configureStore): the user's opt-in, whether Gainalytics was ever connected
 * (to tell "not connected" from "permissions revoked"), the fingerprint of every training
 * written to Health Connect (to update/delete it later) and the last sync result.
 * Transient: the provider status / granted permissions (re-read before every use) and the body
 * weights read from Health Connect — health data is never persisted by Gainalytics.
 */
export interface HealthConnectState {
  writeEnabled: boolean;
  everConnected: boolean;
  /** trainingId → fingerprint of the session last written for it. */
  written: {[trainingId: number]: string};
  /**
   * Part of every Health Connect record id; renewed when the local dataset is replaced (backup
   * restore) or writing starts from scratch, because training ids are then reused. Unset only for
   * entries written before namespaces existed (legacy id format).
   */
  recordNamespace?: string;
  lastSync?: HealthConnectSyncEvent;
  status?: HealthConnectStatus;
  bodyWeights?: BodyWeightsState;
}

export type HealthConnectStatus =
  | {sdkStatus: 'NOT_SUPPORTED'}
  | {sdkStatus: Exclude<HealthConnectSdkStatus, 'AVAILABLE'>; providedBySystem: boolean}
  | {sdkStatus: 'AVAILABLE'; providedBySystem: boolean; granted: string[]; historyReadAvailable: boolean};

export interface HealthConnectSyncEvent {
  kind: 'written' | 'deleted' | 'failed';
  trainingId: number;
  title?: string;
  message?: string;
  at: number;
}

export interface BodyWeightsState {
  /** Oldest first. */
  weights: HealthConnectWeight[];
  error?: string;
  loadedAt: number;
}

export const HEALTH_CONNECT_ACTIONS = {
  // Commands, executed by healthConnectMiddleware.
  REFRESH: 'HEALTH_CONNECT_REFRESH',
  CONNECT: 'HEALTH_CONNECT_CONNECT',
  REQUEST_HISTORY: 'HEALTH_CONNECT_REQUEST_HISTORY',
  LOAD_WEIGHTS: 'HEALTH_CONNECT_LOAD_WEIGHTS',
  // State changes.
  STATUS: 'HEALTH_CONNECT_STATUS',
  SET_WRITE_ENABLED: 'HEALTH_CONNECT_SET_WRITE_ENABLED',
  NEW_RECORD_NAMESPACE: 'HEALTH_CONNECT_NEW_RECORD_NAMESPACE',
  SYNC_RESULT: 'HEALTH_CONNECT_SYNC_RESULT',
  WEIGHTS_LOADED: 'HEALTH_CONNECT_WEIGHTS_LOADED',
} as const;

export const initialHealthConnectState: HealthConnectState = {
  writeEnabled: false,
  everConnected: false,
  written: {},
};

const withoutKey = (written: HealthConnectState['written'], trainingId: number) => {
  const next = {...written};
  delete next[trainingId];
  return next;
};

const healthConnectReducer = (state: HealthConnectState = initialHealthConnectState, action: AnyAction): HealthConnectState => {
  switch (action.type) {
    case HEALTH_CONNECT_ACTIONS.STATUS: {
      const status: HealthConnectStatus = action.status;
      const connected = status.sdkStatus === 'AVAILABLE' && status.granted.length > 0;
      return {
        ...state,
        status,
        everConnected: state.everConnected || connected,
        // Without READ_WEIGHT the weights must not stay visible.
        bodyWeights: status.sdkStatus === 'AVAILABLE' && status.granted.includes(HC_PERMISSION.READ_WEIGHT) ? state.bodyWeights : undefined,
      };
    }
    case HEALTH_CONNECT_ACTIONS.SET_WRITE_ENABLED:
      return {...state, writeEnabled: action.enabled === true};
    case HEALTH_CONNECT_ACTIONS.NEW_RECORD_NAMESPACE:
      return {...state, recordNamespace: action.namespace};
    case HEALTH_CONNECT_ACTIONS.SYNC_RESULT: {
      const event: HealthConnectSyncEvent = action.event;
      const written = state.written ?? {};
      if (event.kind === 'written') return {...state, lastSync: event, written: {...written, [event.trainingId]: action.fingerprint}};
      if (event.kind === 'deleted') return {...state, lastSync: event, written: withoutKey(written, event.trainingId)};
      return {...state, lastSync: event};
    }
    case HEALTH_CONNECT_ACTIONS.WEIGHTS_LOADED:
      return {...state, bodyWeights: {weights: action.weights ?? [], error: action.error, loadedAt: action.loadedAt}};
    case 'FULL_IMPORT':
      // The imported trainings are different ones: forget what was written for the old data. Their
      // ids may repeat ids already used in Health Connect, so the middleware starts a new namespace.
      return {...state, written: {}, lastSync: undefined, recordNamespace: undefined};
    default:
      return state;
  }
};

export default healthConnectReducer;
