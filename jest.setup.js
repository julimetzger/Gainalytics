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
