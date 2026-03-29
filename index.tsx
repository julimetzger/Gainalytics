/**
 * @format
 */

require('react-native/Libraries/Core/InitializeCore');

const {AppRegistry, LogBox} = require('react-native');
const App = require('./App').default;
const {name: appName} = require('./app.json');

if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

AppRegistry.registerComponent(appName, () => App);
