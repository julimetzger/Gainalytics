/**
 * @format
 */

import {AppRegistry, LogBox} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {initSecureStore} from './app/utils/secureStorage';

// Initialise per-device MMKV encryption key from platform keychain before any component mounts.
initSecureStore().catch(() => {
  // Error is handled gracefully inside initSecureStore; ignore here.
});

if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

AppRegistry.registerComponent(appName, () => App);
