/**
 * GH-528 (T1): what the Settings entry shows for the current Health Connect state.
 */
import {HealthConnectState} from '../../redux/HealthConnect/healthConnectReducer';
import {CONNECT_PERMISSIONS, HC_PERMISSION, HealthConnectPermission} from './healthConnectNative';

export type HealthConnectConnection =
  | {kind: 'checking'}
  | {kind: 'not_supported'}
  | {kind: 'not_installed'}
  | {kind: 'update_required'}
  | {kind: 'unavailable'}
  | {kind: 'not_connected'}
  | {kind: 'revoked'}
  | {kind: 'connected'; granted: HealthConnectPermission[]; missing: HealthConnectPermission[]};

export const HEALTH_CONNECT_PERMISSION_LABELS: Record<HealthConnectPermission, string> = {
  [HC_PERMISSION.READ_EXERCISE]: 'Read trainings',
  [HC_PERMISSION.WRITE_EXERCISE]: 'Write trainings',
  [HC_PERMISSION.READ_WEIGHT]: 'Read body weight',
  [HC_PERMISSION.READ_HISTORY]: 'Read data older than 30 days',
};

const KNOWN_PERMISSIONS: HealthConnectPermission[] = Object.values(HC_PERMISSION);

export const describeHealthConnectConnection = (state: Pick<HealthConnectState, 'status' | 'everConnected'> | undefined): HealthConnectConnection => {
  const status = state?.status;
  if (!status) return {kind: 'checking'};
  switch (status.sdkStatus) {
    case 'NOT_SUPPORTED':
      return {kind: 'not_supported'};
    case 'PROVIDER_UPDATE_REQUIRED':
      return {kind: 'update_required'};
    case 'UNAVAILABLE':
      // Up to Android 13 the Health Connect app is missing; on 14+ it is part of the system.
      return status.providedBySystem ? {kind: 'unavailable'} : {kind: 'not_installed'};
    case 'AVAILABLE': {
      const granted = KNOWN_PERMISSIONS.filter((permission) => status.granted.includes(permission));
      if (granted.length === 0) return state?.everConnected ? {kind: 'revoked'} : {kind: 'not_connected'};
      const missing = CONNECT_PERMISSIONS.filter((permission) => !granted.includes(permission));
      return {kind: 'connected', granted, missing};
    }
  }
};

export const canWriteTrainings = (connection: HealthConnectConnection) => connection.kind === 'connected' && connection.granted.includes(HC_PERMISSION.WRITE_EXERCISE);

export const canReadBodyWeight = (connection: HealthConnectConnection) => connection.kind === 'connected' && connection.granted.includes(HC_PERMISSION.READ_WEIGHT);
