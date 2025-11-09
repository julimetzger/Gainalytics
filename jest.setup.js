// jest.setup.js
// Silence Animated: "useNativeDriver" warnings, etc.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Reanimated mock (required by the plugin in tests)
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
