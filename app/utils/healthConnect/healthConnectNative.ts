/**
 * GH-528: typed access to the native module `HealthConnect` (android/app/src/main/.../healthconnect).
 * Android only — on iOS (and in tests without a mock) the module is undefined and every caller
 * must treat Health Connect as not supported.
 */
import {NativeModules, Platform} from 'react-native';
import {HealthConnectSessionInput} from './healthConnectMapping';

export type HealthConnectSdkStatus = 'AVAILABLE' | 'PROVIDER_UPDATE_REQUIRED' | 'UNAVAILABLE';

export const HC_PERMISSION = {
  READ_EXERCISE: 'android.permission.health.READ_EXERCISE',
  WRITE_EXERCISE: 'android.permission.health.WRITE_EXERCISE',
  READ_WEIGHT: 'android.permission.health.READ_WEIGHT',
  READ_HISTORY: 'android.permission.health.READ_HEALTH_DATA_HISTORY',
} as const;

export type HealthConnectPermission = (typeof HC_PERMISSION)[keyof typeof HC_PERMISSION];

/** What "Connect" asks for. The history permission is asked separately, by the body weight screen. */
export const CONNECT_PERMISSIONS: HealthConnectPermission[] = [HC_PERMISSION.READ_EXERCISE, HC_PERMISSION.WRITE_EXERCISE, HC_PERMISSION.READ_WEIGHT];

export interface HealthConnectWeight {
  kg: number;
  /** Epoch ms of the measurement. */
  time: number;
  /** Package name of the app that wrote the value. */
  origin: string;
  /** App label of [origin] as far as Android lets Gainalytics see it, else the package name. */
  originLabel: string;
}

interface HealthConnectNativeModule {
  getSdkStatus(): Promise<HealthConnectSdkStatus>;
  isProvidedBySystem(): Promise<boolean>;
  getGrantedPermissions(): Promise<string[]>;
  requestPermissions(permissions: string[]): Promise<string[]>;
  isHistoryReadAvailable(): Promise<boolean>;
  readWeights(startMs: number, endMs: number): Promise<HealthConnectWeight[]>;
  writeStrengthSession(session: HealthConnectSessionInput): Promise<string[]>;
  deleteStrengthSession(clientRecordId: string): Promise<boolean>;
  openHealthConnect(): Promise<boolean>;
  openManagePermissions(): Promise<boolean>;
}

export const getHealthConnect = (): HealthConnectNativeModule | undefined =>
  Platform.OS === 'android' ? (NativeModules.HealthConnect satisfies HealthConnectNativeModule | undefined) : undefined;

/** Play Store page of the Health Connect app (needed up to Android 13). */
export const HEALTH_CONNECT_PLAY_STORE_URL = 'market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding';
export const HEALTH_CONNECT_PLAY_STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
