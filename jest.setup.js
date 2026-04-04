// jest.setup.js
// Silence Animated: "useNativeDriver" warnings, etc.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Reanimated mock (required by the plugin in tests)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  const chainable = () => {
    const obj = {};
    const handler = {get: (_, prop) => (prop === Symbol.toPrimitive ? undefined : () => new Proxy(obj, handler))};
    return new Proxy(obj, handler);
  };
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({children}) => children,
    Gesture: {
      Pinch: chainable,
      Pan: chainable,
      Simultaneous: chainable,
    },
  };
});

// Mock react-redux hooks globally so component tests do not require a Provider.
// Tests that need specific selector behaviour mock react-redux themselves.
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(() => []),
  useDispatch: jest.fn(() => jest.fn()),
}));

// Mock DocumentPicker
jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: {
    allFiles: 'allFiles',
  },
  isCancel: jest.fn(),
}));

// Mock RNFS
jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  DownloadDirectoryPath: '/mock/path',
}));

// Mock @notifee/react-native
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue({authorizationStatus: 1}),
    createChannel: jest.fn().mockResolvedValue('default'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    onBackgroundEvent: jest.fn(),
    onForegroundEvent: jest.fn(() => () => {}),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    createTriggerNotification: jest.fn().mockResolvedValue(undefined),
    cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  },
  AuthorizationStatus: {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    DENIED: 0,
    NOT_DETERMINED: -1,
  },
  AndroidImportance: {HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0},
  EventType: {PRESS: 1, DISMISSED: 0, ACTION_PRESS: 2, DELIVERED: 3},
  TriggerType: {TIMESTAMP: 0, INTERVAL: 1},
  AlarmType: {SET: 0, SET_ALARMCLOCK: 3, SET_AND_ALLOW_WHILE_IDLE: 1, SET_EXACT: 2, SET_EXACT_AND_ALLOW_WHILE_IDLE: 4},
}));
