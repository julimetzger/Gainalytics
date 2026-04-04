// jest.setup.js
// Silence Animated: "useNativeDriver" warnings, etc.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Reanimated mock (required by the plugin in tests)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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

// Mock @notifee/react-native (native module, not available in Jest)
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('channel-id'),
    requestPermission: jest.fn().mockResolvedValue({authorizationStatus: 1}),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    onForegroundEvent: jest.fn().mockReturnValue(() => {}),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: {HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0},
  AuthorizationStatus: {AUTHORIZED: 1, DENIED: 0, NOT_DETERMINED: -1},
  EventType: {DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3, APP_BLOCKED: 4, CHANNEL_BLOCKED: 5, CHANNEL_GROUP_BLOCKED: 6, TRIGGER_NOTIFICATION_CREATED: 7, FG_ALREADY_EXIST: 8},
}));
