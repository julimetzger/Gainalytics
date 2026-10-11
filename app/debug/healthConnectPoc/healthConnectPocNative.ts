/**
 * GH-502 proof of concept: typed access to the debug-only native module `HealthConnectPoc`
 * (android/app/src/debug). Release builds don't contain the module, so everything here
 * must cope with it being undefined.
 */
import {NativeModules, Platform} from 'react-native';
import {HealthConnectSessionInput} from './healthConnectMapping';

export type HealthConnectSdkStatus =
  | 'AVAILABLE'
  | 'PROVIDER_UPDATE_REQUIRED'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED_ANDROID_VERSION';

export interface HealthConnectWeight {
  kg: number;
  time: number;
  origin: string;
}

export interface HealthConnectSessionSummary {
  title: string | null;
  exerciseType: number;
  startMs: number;
  endMs: number;
  origin: string;
  clientRecordId: string | null;
  segmentCount: number;
  repetitions: number;
}

interface HealthConnectPocNativeModule {
  getSdkStatus(): Promise<HealthConnectSdkStatus>;
  getGrantedPermissions(): Promise<string[]>;
  requestPermissions(): Promise<string[]>;
  readWeights(days: number): Promise<HealthConnectWeight[]>;
  writeStrengthSession(session: Omit<HealthConnectSessionInput, 'segments'> & {segments: object[]}): Promise<string[]>;
  readExerciseSessions(days: number): Promise<HealthConnectSessionSummary[]>;
  openHealthConnect(): Promise<boolean>;
}

export const getHealthConnectPoc = (): HealthConnectPocNativeModule | undefined =>
  Platform.OS === 'android' ? (NativeModules.HealthConnectPoc as HealthConnectPocNativeModule | undefined) : undefined;

/** True only in debug builds that ship the PoC module. */
export const isHealthConnectPocAvailable = (): boolean => getHealthConnectPoc() !== undefined;
