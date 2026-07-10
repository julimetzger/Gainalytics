import {NativeModules} from 'react-native';

interface AppInfoNativeModule {
  versionName?: string;
}

interface NativeModuleRegistry {
  AppInfo?: AppInfoNativeModule;
}

const UNKNOWN_APP_VERSION = 'Unknown';

export const getAppVersion = (): string => {
  const nativeModules: NativeModuleRegistry = NativeModules;
  const versionName = nativeModules.AppInfo?.versionName?.trim();

  return versionName && versionName.length > 0 ? versionName : UNKNOWN_APP_VERSION;
};
