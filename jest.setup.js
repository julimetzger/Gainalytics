// jest.setup.js
// Note: react-native/Libraries/Animated/NativeAnimatedHelper was removed in RN 0.76+.
// The RN jest preset handles animated mocking internally — no explicit mock needed.

// Provide a NavigationContainer-free useFocusEffect so components using it
// can render in unit tests that don't wrap in NavigationContainer.
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb) => React.useEffect(cb, []),
    useIsFocused: () => true,
  };
});

// Mock react-native-keychain (native module — unavailable in JS test environment)
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
}));

// Mock react-native-mmkv (used for secureStorage and insightCache)
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(() => false),
  })),
}));

// react-native-worklets mock (required by reanimated 4.x which imports worklets at init time)
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

// Reanimated mock (required by the plugin in tests). The shipped mock omits
// useFrameCallback, so extend it with a no-op implementation that returns the
// FrameCallback shape so components that register a frame callback render in tests.
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    useFrameCallback: jest.fn().mockReturnValue({
      setActive: () => {},
      isActive: false,
      callbackId: 0,
    }),
  };
});

// Mock react-native-draggable-flatlist (includes NestableScrollContainer used by TrainingsPlanNode)
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const {View} = require('react-native');
  const ScaleDecorator = ({children}) => children;
  const ListComponent = ({data, renderItem, keyExtractor}) =>
    React.createElement(
      View,
      null,
      (data || []).map((item, index) =>
        React.createElement(View, {key: keyExtractor ? keyExtractor(item) : String(index)}, renderItem({item, drag: () => {}, isActive: false})),
      ),
    );
  const NestableScrollContainer = ({children, ...rest}) => React.createElement(View, rest, children);
  return {
    __esModule: true,
    default: ListComponent,
    NestableDraggableFlatList: ListComponent,
    NestableScrollContainer,
    NestableScrollContainerProvider: ({children}) => children,
    ScaleDecorator,
    useNestableScrollContainerContext: () => undefined,
  };
});

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
    usePanGesture: () => ({}),
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
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  DownloadDirectoryPath: '/mock/path',
  DocumentDirectoryPath: '/mock/documents',
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
