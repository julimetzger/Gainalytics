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
