/**
 * @format
 */

// MUST be imported before any code that touches @react-navigation/drawer or
// react-native-drawer-layout. Without this import the gesture-handler native
// module is not registered at JS evaluation time, which can crash any screen
// that uses a Drawer in release builds (Analyse tab + TrainingsPlanTab).
import 'react-native-gesture-handler';
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
