import React from 'react';
import {Alert, NativeModules, Platform} from 'react-native';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import SettingsTab from '../../../app/tabs/settings/SettingsTab';
import {useSettings} from '../../../app/redux/settings/use/useSettings';
import {useStore} from 'react-redux';
import DocumentPicker from 'react-native-document-picker';
import Toast from 'react-native-toast-message';
import {dispatchFullImport} from '../../../app/redux/fullstateactions/dispatchFullImport';
import {dispatchSetPauseTimer} from '../../../app/redux/settings/dispatch/dispatchSetPauseTimer';
import {dispatchSetFinishTrainingTimer} from '../../../app/redux/settings/dispatch/dispatchSetFinishTrainingTimer';
import {dispatchToggleDisable1RMpreselect} from '../../../app/redux/settings/dispatch/dispatchToggleDisable1RMpreselect';
import {dispatchToggleShowTimer} from '../../../app/redux/settings/dispatch/dispatchToggleShowTimer';
import {dispatchToggleShowToasts} from '../../../app/redux/settings/dispatch/dispatchToggleShowToasts';
import {dispatchSetPalette} from '../../../app/redux/settings/dispatch/dispatchSetPalette';
import {dispatchSetExactAlarmPermission} from '../../../app/redux/settings/dispatch/dispatchSetExactAlarmPersmission';
import {canScheduleExactAlarms, openExactAlarmSettings} from '../../../app/utils/NotificationUtils';
import {dispatchSetAnthropicModel} from '../../../app/redux/settings/dispatch/dispatchSetAnthropicModel';
import {useAnthropicModel} from '../../../app/redux/settings/use/useAnthropicModel';
import {DEFAULT_ANTHROPIC_MODEL} from '../../../app/utils/llmApi';
import rootReducer from '../../../app/redux/rootReducer';
import {buildStrongImport, parseStrongCsv} from '../../../app/utils/strongCsv/strongImport';
import type {Props as SettingsTabProps} from '../../../app/tabs/settings/SettingsTab';

// Screen-prop fixtures: a complete navigation mock (checked against the screen's navigation prop,
// fresh jest.fn()s per call) and a complete RouteProp so the typecheck also covers the params.
const createNavigation = () =>
  ({
    dispatch: jest.fn(),
    navigate: jest.fn(),
    navigateDeprecated: jest.fn(),
    preload: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    getId: jest.fn(() => undefined),
    getParent: jest.fn(),
    getState: jest.fn(),
    addListener: jest.fn(() => () => undefined),
    removeListener: jest.fn(),
    setParams: jest.fn(),
    replaceParams: jest.fn(),
    setOptions: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    popTo: jest.fn(),
    popToTop: jest.fn(),
  }) satisfies SettingsTabProps['navigation'];
const settingsRoute = (params: SettingsTabProps['route']['params']): SettingsTabProps['route'] => ({
  key: 'Settings-test',
  name: 'Settings',
  params,
});

const mockSetAnthropicModel = jest.fn();
const mockToggleDisable1RM = jest.fn();
const mockToggleShowTimer = jest.fn();
const mockToggleShowToasts = jest.fn();
const mockSetPalette = jest.fn();
const mockSetExactAlarmPermission = jest.fn();
const mockFullImport = jest.fn();
const mockSetPauseTimer = jest.fn();
const mockSetFinishTrainingTimer = jest.fn();
const mockStoreGetState = jest.fn();
const mockShowOnboarding = jest.fn();
const mockStrongImport = jest.fn();
const mockStrongCsvState = jest.fn();

jest.mock('react-redux', () => ({
  useStore: jest.fn(),
}));

// GH-504: provider choice. Unset in every existing test → Claude, exactly as before.
const mockUseAiProvider = jest.fn(() => 'claude');
jest.mock('../../../app/redux/settings/use/useAiProvider', () => ({
  useAiProvider: () => mockUseAiProvider(),
}));
jest.mock('../../../app/components/settings/AiProviderSelector', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {__esModule: true, default: () => <View testID="settings-ai-provider" />};
});
jest.mock('../../../app/components/settings/MuscleListSettings', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {__esModule: true, default: () => <View testID="settings-muscle-list" />};
});
jest.mock('../../../app/components/settings/ChatGptAccountSection', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {__esModule: true, default: () => <View testID="settings-chatgpt-section" />};
});

jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: {
    pickSingle: jest.fn(),
    types: {
      allFiles: 'allFiles',
    },
  },
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('../../../app/redux/fullstateactions/dispatchFullImport', () => ({
  dispatchFullImport: jest.fn(() => mockFullImport),
}));

jest.mock('../../../app/redux/fullstateactions/dispatchStrongImport', () => ({
  dispatchStrongImport: () => mockStrongImport,
}));

// GH-496: the Strong CSV preview/export read their data through selectors, not the store.
jest.mock('../../../app/redux/fullstateactions/use/useStrongCsvState', () => ({
  useStrongCsvState: () => mockStrongCsvState(),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchOnboarding', () => ({
  dispatchShowOnboarding: () => mockShowOnboarding,
  dispatchCompleteOnboarding: () => jest.fn(),
}));
jest.mock('../../../app/redux/settings/dispatch/dispatchSetPauseTimer', () => ({
  dispatchSetPauseTimer: jest.fn(() => mockSetPauseTimer),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetFinishTrainingTimer', () => ({
  dispatchSetFinishTrainingTimer: jest.fn(() => mockSetFinishTrainingTimer),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchToggleDisable1RMpreselect', () => ({
  dispatchToggleDisable1RMpreselect: jest.fn(() => mockToggleDisable1RM),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchToggleShowTimer', () => ({
  dispatchToggleShowTimer: jest.fn(() => mockToggleShowTimer),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchToggleShowToasts', () => ({
  dispatchToggleShowToasts: jest.fn(() => mockToggleShowToasts),
}));

// GH-404: the dark-mode switch became its own component with its own spec.
// This suite mocks react-native-paper away wholesale, so the real control
// cannot render here — stub it and assert only that the row is wired in.
jest.mock('../../../app/components/settings/ThemeModeSelector', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return {
    __esModule: true,
    default: () => (
      <View testID="settings-theme-mode-row">
        <Text>Theme</Text>
      </View>
    ),
  };
});

// GH-478: the colour row and the section wrapper have their own specs against
// the real react-native-paper; here they are stubbed like the mode selector above.
jest.mock('../../../app/components/settings/ThemeColorSelector', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return {
    __esModule: true,
    default: () => (
      <View testID="settings-theme-palette-row">
        <Text>Color</Text>
      </View>
    ),
  };
});

jest.mock('../../../app/components/settings/SettingsSection', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return {
    __esModule: true,
    default: ({title, testID, children}: {title: string; testID: string; children: React.ReactNode}) => (
      <View testID={testID}>
        <Text testID={`${testID}-title`}>{title}</Text>
        {children}
      </View>
    ),
  };
});

jest.mock('../../../app/redux/settings/dispatch/dispatchSetPalette', () => ({
  dispatchSetPalette: jest.fn(() => mockSetPalette),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetExactAlarmPersmission', () => ({
  dispatchSetExactAlarmPermission: jest.fn(() => mockSetExactAlarmPermission),
}));

jest.mock('../../../app/utils/NotificationUtils', () => ({
  canScheduleExactAlarms: jest.fn(),
  openExactAlarmSettings: jest.fn(),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetAnthropicModel', () => ({
  dispatchSetAnthropicModel: jest.fn(() => mockSetAnthropicModel),
}));

jest.mock('../../../app/redux/settings/use/useAnthropicModel', () => ({
  useAnthropicModel: jest.fn(() => 'claude-haiku-4-5-20251001'),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetAIChatPrompt', () => ({
  dispatchSetAIChatPrompt: jest.fn(() => jest.fn()),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchResetAIChatPrompt', () => ({
  dispatchResetAIChatPrompt: jest.fn(() => jest.fn()),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetAITrainingPrompt', () => ({
  dispatchSetAITrainingPrompt: jest.fn(() => jest.fn()),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchResetAITrainingPrompt', () => ({
  dispatchResetAITrainingPrompt: jest.fn(() => jest.fn()),
}));

jest.mock('../../../app/redux/settings/use/useAIChatPrompt', () => ({
  useAIChatPrompt: jest.fn(() => 'default chat prompt'),
}));

jest.mock('../../../app/redux/settings/use/useAITrainingPrompt', () => ({
  useAITrainingPrompt: jest.fn(() => 'default training prompt'),
}));

jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {
    getAnthropicApiKey: jest.fn(() => undefined),
    setAnthropicApiKey: jest.fn(),
    deleteAnthropicApiKey: jest.fn(),
    hasAnthropicApiKey: jest.fn(() => false),
  },
}));

jest.mock('../../../app/utils/llmApi', () => ({
  validateAnthropicApiKey: jest.fn().mockResolvedValue({ok: true, text: 'OK'}),
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(() => false),
  })),
}));

jest.mock('../../../app/components/picker/date/TimeRangePicker', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({title, setPauseTimer}: {title: string; setPauseTimer: (seconds: number) => void}) => (
    <View>
      <Text>{title}</Text>
      <TouchableOpacity
        testID={`timer-picker-${title}`}
        onPress={() => {
          setPauseTimer(120);
        }}
      >
        <Text>Set Timer</Text>
      </TouchableOpacity>
    </View>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  const radioState = {
    onValueChange: (value: string) => value,
  };

  const Dialog = ({children, visible}: {children: React.ReactNode; visible: boolean}) => (visible ? <View>{children}</View> : null);
  Dialog.Title = ({children}: {children: React.ReactNode}) => <Text>{children}</Text>;
  Dialog.Content = ({children}: {children: React.ReactNode}) => <View>{children}</View>;
  Dialog.ScrollArea = ({children}: {children: React.ReactNode}) => <View>{children}</View>;
  Dialog.Actions = ({children}: {children: React.ReactNode}) => <View>{children}</View>;

  const RadioButton = ({value}: {value: string}) => (
    <TouchableOpacity
      testID={`radio-${value}`}
      onPress={() => {
        radioState.onValueChange(value);
      }}
    >
      <Text>{value}</Text>
    </TouchableOpacity>
  );

  RadioButton.Group = ({children, onValueChange}: {children: React.ReactNode; onValueChange: (value: string) => void}) => {
    radioState.onValueChange = onValueChange;
    return <View>{children}</View>;
  };

  return {
    useTheme: () => ({
      dark: false,
      colors: {
        primary: '#415F91',
        onPrimary: '#FFFFFF',
        primaryContainer: '#D6E3FF',
        onPrimaryContainer: '#284777',
        surface: '#F9F9FF',
        onSurface: '#191C20',
        surfaceVariant: '#E0E2EC',
        onSurfaceVariant: '#44474E',
        outline: '#74777F',
      },
    }),
    Button: ({children, onPress, disabled}: {children: React.ReactNode; onPress?: () => void; disabled?: boolean}) => (
      <TouchableOpacity
        testID={`button-${String(children).replace(/\s+/g, '-')}`}
        accessibilityState={{disabled: !!disabled}}
        onPress={() => {
          if (!disabled && onPress) {
            onPress();
          }
        }}
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Dialog,
    SegmentedButtons: ({buttons, onValueChange}: {buttons: {value: string; testID: string}[]; onValueChange: (value: string) => void}) => (
      <View>
        {buttons.map((b) => (
          <TouchableOpacity key={b.value} testID={b.testID} onPress={() => onValueChange(b.value)}>
            <Text>{b.value}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    Divider: () => <View testID="divider" />,
    Portal: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
    RadioButton,
    Switch: ({onValueChange, value}: {onValueChange?: (value: boolean) => void; value: boolean}) => (
      <TouchableOpacity
        testID="settings-switch"
        onPress={() => {
          if (onValueChange) {
            onValueChange(!value);
          }
        }}
      >
        <Text>{value ? 'on' : 'off'}</Text>
      </TouchableOpacity>
    ),
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    HelperText: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    ActivityIndicator: () => <View testID="activity-indicator" />,
    List: {
      Accordion: ({children, title, expanded, onPress, testID}: {children: React.ReactNode; title: string; expanded?: boolean; onPress?: () => void; testID?: string}) => (
        <View>
          <TouchableOpacity testID={testID} onPress={onPress}><Text>{title}</Text></TouchableOpacity>
          {expanded && <View>{children}</View>}
        </View>
      ),
      Icon: () => null,
    },
    TextInput: Object.assign(
      ({value, onChangeText, label, testID}: {value?: string; onChangeText?: (t: string) => void; label?: string; testID?: string; [k: string]: any}) => {
        const {TextInput: RNTextInput} = require('react-native');
        return (
          <View>
            <Text>{label}</Text>
            <RNTextInput testID={testID} value={value} onChangeText={onChangeText} />
          </View>
        );
      },
      {
        Icon: ({icon, onPress}: {icon: string; onPress?: () => void}) => (
          <TouchableOpacity onPress={onPress} testID={`text-input-icon-${icon}`}>
            <Text>{icon}</Text>
          </TouchableOpacity>
        ),
      },
    ),
  };
});

const fileSaver = require('react-native-fs');

const mockedUseSettings = jest.mocked(useSettings);
const mockedUseStore = jest.mocked(useStore);
const mockedDispatchToggleDisable1RM = jest.mocked(dispatchToggleDisable1RMpreselect);
const mockedDispatchToggleShowTimer = jest.mocked(dispatchToggleShowTimer);
const mockedDispatchToggleShowToasts = jest.mocked(dispatchToggleShowToasts);
const mockedDispatchSetPalette = jest.mocked(dispatchSetPalette);
const mockedDispatchSetExactAlarmPermission = jest.mocked(dispatchSetExactAlarmPermission);
const mockedDispatchFullImport = jest.mocked(dispatchFullImport);
const mockedDispatchSetPauseTimer = jest.mocked(dispatchSetPauseTimer);
const mockedDispatchSetFinishTrainingTimer = jest.mocked(dispatchSetFinishTrainingTimer);
const mockedCanScheduleExactAlarms = jest.mocked(canScheduleExactAlarms);
const mockedOpenExactAlarmSettings = jest.mocked(openExactAlarmSettings);
const mockedPickSingle = jest.mocked(DocumentPicker.pickSingle);
const nativeModulesWithAppInfo: {AppInfo?: {versionName?: string}} = NativeModules;

describe('SettingsTab', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {value: 'android', configurable: true});
    Object.defineProperty(Platform, 'Version', {value: 33, configurable: true});
    nativeModulesWithAppInfo.AppInfo = {versionName: '0.168'};

    mockedUseSettings.mockReturnValue({
      mode: 'light',
      palette: 'blue',
      toggles: {
        disable1RMButton: false,
        disableTimer: false,
        disableToasts: false,
      },
      localNotification: {
        pauseTimerInSeconds: 30,
        finishTrainingTimerInSeconds: 45,
      },
    });

    mockStoreGetState.mockReturnValue({training: 'state'});
    mockedUseStore.mockReturnValue({
      getState: mockStoreGetState,
    });

    mockedDispatchToggleDisable1RM.mockClear();
    mockedDispatchToggleShowTimer.mockClear();
    mockedDispatchToggleShowToasts.mockClear();
    mockedDispatchSetPalette.mockClear();
    mockedDispatchSetExactAlarmPermission.mockClear();
    mockedDispatchFullImport.mockClear();
    mockedDispatchSetPauseTimer.mockClear();
    mockedDispatchSetFinishTrainingTimer.mockClear();

    mockToggleDisable1RM.mockReset();
    mockToggleShowTimer.mockReset();
    mockToggleShowToasts.mockReset();
    mockSetPalette.mockReset();
    mockSetExactAlarmPermission.mockReset();
    mockFullImport.mockReset();
    mockSetPauseTimer.mockReset();
    mockSetFinishTrainingTimer.mockReset();
    mockSetAnthropicModel.mockReset();

    mockedCanScheduleExactAlarms.mockResolvedValue(false);
    mockedOpenExactAlarmSettings.mockResolvedValue();
    mockedPickSingle.mockResolvedValue({uri: '/tmp/import.gains', name: 'import.gains', type: null, fileCopyUri: null, size: null});
    fileSaver.readFile.mockResolvedValue('{"imported":true}');
    fileSaver.writeFile.mockResolvedValue(undefined);

    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(Date, 'now').mockReturnValue(1234);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('dispatches switch toggles', async () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getAllByTestId, getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(mockSetExactAlarmPermission).toHaveBeenCalledWith(false);
    });

    const switches = getAllByTestId('settings-switch');
    fireEvent.press(switches[0]);
    fireEvent.press(switches[1]);
    fireEvent.press(switches[2]);
    fireEvent.press(switches[3]);

    expect(mockToggleDisable1RM).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Nope. This app is not using stupid measuring systems.');
    expect(mockToggleShowTimer).toHaveBeenCalledTimes(1);
    expect(mockToggleShowToasts).toHaveBeenCalledTimes(1);
  });

  it('groups the settings into titled sections, theme first', () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getAllByTestId, getByTestId, queryByText} = render(<SettingsTab navigation={navigation} route={route} />);

    const titles = getAllByTestId(/^settings-section-[a-z-]+-title$/).map((node) => node.props.children);
    expect(titles).toEqual(['Appearance', 'General', 'Muscles', 'Timers & Notifications', 'AI Coach', 'Help', 'Data']);
    // GH-523: the muscle list lives in its own section.
    expect(getByTestId('settings-section-muscles')).toContainElement(getByTestId('settings-muscle-list'));

    // GH-478: the Theme row and the single "Color" row share one section.
    expect(getByTestId('settings-section-theme')).toContainElement(getByTestId('settings-theme-mode-row'));
    expect(getByTestId('settings-section-theme')).toContainElement(getByTestId('settings-theme-palette-row'));
    expect(queryByText('Color Palette')).toBeNull();
    expect(queryByText('Theme Color')).toBeNull();
    expect(queryByText('Enable Dark Mode')).toBeNull();
  });

  it('imports data through the dialog and dispatches full import', async () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId, getByText, queryByText} = render(<SettingsTab navigation={navigation} route={route} />);

    fireEvent.press(getByTestId('button-Import-Data'));
    expect(getByText('Import full data from backup file?')).toBeTruthy();

    fireEvent.press(getByTestId('button-Cancel'));
    expect(queryByText('Import full data from backup file?')).toBeNull();

    fireEvent.press(getByTestId('button-Import-Data'));
    fireEvent.press(getByTestId('button-Import'));

    await waitFor(() => {
      expect(mockedPickSingle).toHaveBeenCalledWith({type: [DocumentPicker.types.allFiles]});
    });

    await waitFor(() => {
      expect(mockFullImport).toHaveBeenCalledWith({imported: true});
    });

    expect(Toast.show).toHaveBeenCalledWith({
      type: 'info',
      text1: 'Import successful!',
      text2: 'Data imported from import.gains',
      position: 'top',
      visibilityTime: 5000,
    });
  });

  it('reopens the onboarding from the Help section (GH-497)', () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('button-Show-Introduction'));

    expect(mockShowOnboarding).toHaveBeenCalledTimes(1);
  });

  it('opens the import confirmation when the onboarding asks for it (GH-497)', () => {
    const navigation = createNavigation();
    const route = settingsRoute({openImport: true});

    const {getByText} = render(<SettingsTab navigation={navigation} route={route} />);

    expect(getByText('Import full data from backup file?')).toBeTruthy();
    expect(navigation.setParams).toHaveBeenCalledWith({openImport: undefined});
  });

  it('renders the app version supplied by the native build', () => {
    nativeModulesWithAppInfo.AppInfo = {versionName: '9.8.7'};
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    expect(getByTestId('settings-app-version')).toHaveTextContent('Version 9.8.7');
  });

  it('GH-502: long-pressing the version does nothing without the debug-only Health Connect PoC module', () => {
    delete (NativeModules as any).HealthConnectPoc;
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
    fireEvent(getByTestId('settings-app-version'), 'longPress');

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('GH-502: long-pressing the version opens the Health Connect PoC when the debug module exists', () => {
    (NativeModules as any).HealthConnectPoc = {};
    const navigation = createNavigation();
    const route = settingsRoute({});

    try {
      const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent(getByTestId('settings-app-version'), 'longPress');

      expect(navigation.navigate).toHaveBeenCalledWith('HealthConnectPoc');
    } finally {
      delete (NativeModules as any).HealthConnectPoc;
    }
  });

  it('exports data into file system and shows exported path', () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    fireEvent.press(getByTestId('button-Export-Data'));

    expect(fileSaver.writeFile).toHaveBeenCalledWith('/mock/path/1234.gains', '{"training":"state"}');
    expect(Alert.alert).toHaveBeenCalledWith('exported to /mock/path/1234.gains');
  });

  describe('Strong CSV (GH-496)', () => {
    const navigation = createNavigation();
    const route = settingsRoute({});
    const emptyState = () => rootReducer(undefined as any, {type: '@@INIT'});
    const stateWithOneSet = () => {
      const state: any = emptyState();
      state.workouts = {
        ...state.workouts,
        byId: {1: {id: 1, exerciseId: 2, start: '2024-01-01T17:00:00.000Z', end: '2024-01-01T18:00:00.000Z', sets: [{index: 1, weight: 100, reps: 5, rir: 2}]}},
        allIds: [1],
        byExerciseId: {2: [1]},
      };
      return state;
    };
    const nativeModulesWithShare: {FileShare?: {shareFile: jest.Mock}} = NativeModules;
    const strongCsv =
      '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"\n' +
      '"1";"2024-01-01 18:00:00";"Push";"3600";"Bench Press";"1";"100.0";"5";"8";"";"";"";""\n' +
      '"2";"2024-01-03 18:00:00";"Pull";"3600";"Deadlift";"1";"180.0";"3";"";"";"";"";""\n';

    beforeEach(() => {
      nativeModulesWithShare.FileShare = {shareFile: jest.fn().mockResolvedValue(true)};
      mockStrongCsvState.mockReturnValue(emptyState());
    });

    afterEach(() => {
      delete nativeModulesWithShare.FileShare;
    });

    it('shows both entries next to the .gains buttons', () => {
      const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
      expect(getByTestId('button-Export-as-CSV-(Strong-format)')).toBeTruthy();
      expect(getByTestId('button-Import-from-Strong-CSV')).toBeTruthy();
      expect(getByTestId('button-Import-Data')).toBeTruthy();
      expect(getByTestId('button-Export-Data')).toBeTruthy();
    });

    it('shows a hint instead of a file when there are no logged sets', async () => {
      mockStrongCsvState.mockReturnValue(emptyState());
      const {getByTestId, findByText} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent.press(getByTestId('button-Export-as-CSV-(Strong-format)'));
      expect(await findByText('Nothing to export')).toBeTruthy();
      expect(fileSaver.writeFile).not.toHaveBeenCalled();
      expect(nativeModulesWithShare.FileShare.shareFile).not.toHaveBeenCalled();
    });

    it('writes the CSV and opens the share sheet', async () => {
      mockStrongCsvState.mockReturnValue(stateWithOneSet());
      const {getByTestId, findByText} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent.press(getByTestId('button-Export-as-CSV-(Strong-format)'));
      expect(await findByText('Exported 1 set from 1 workout')).toBeTruthy();
      const [path, csv] = fileSaver.writeFile.mock.calls[0];
      expect(path).toMatch(/\/exports\/gainalytics_strong_\d{4}-\d{2}-\d{2}\.csv$/);
      expect(csv.split('\n')[1]).toContain('"Squat";"1";"100.0";"5";"8"');
      expect(nativeModulesWithShare.FileShare.shareFile).toHaveBeenCalledWith(path, 'text/csv', 'Export as CSV (Strong format)');
    });

    it('rejects an invalid file without importing anything', async () => {
      mockStrongCsvState.mockReturnValue(emptyState());
      mockedPickSingle.mockResolvedValue({uri: '/tmp/bad.csv', name: 'bad.csv', type: null, fileCopyUri: null, size: null});
      fileSaver.readFile.mockResolvedValue('name,value\nfoo,1\n');
      const {getByTestId, findByText, getByText} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent.press(getByTestId('button-Import-from-Strong-CSV'));
      expect(await findByText('Import failed')).toBeTruthy();
      expect(getByText(/bad\.csv: This is not a Strong CSV export .*Nothing was imported\./)).toBeTruthy();
      expect(mockStrongImport).not.toHaveBeenCalled();
    });

    it('shows a summary and imports on confirm', async () => {
      mockStrongCsvState.mockReturnValue(emptyState());
      mockedPickSingle.mockResolvedValue({uri: '/tmp/strong.csv', name: 'strong.csv', type: null, fileCopyUri: null, size: null});
      fileSaver.readFile.mockResolvedValue(strongCsv);
      const {getByTestId, findByText, getByText} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent.press(getByTestId('button-Import-from-Strong-CSV'));
      expect(await findByText('2 trainings in 1 week')).toBeTruthy();
      expect(getByText(/New plan "Strong Import", trainings named by workout name: Push, Pull/)).toBeTruthy();
      expect(mockStrongImport).not.toHaveBeenCalled();
      fireEvent.press(getByTestId('button-Import'));
      expect(mockStrongImport).toHaveBeenCalledWith(expect.objectContaining({setCount: 2}), {assumedWeightUnit: 'kg'});
      expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({text1: 'Strong import finished', text2: 'Plan "Strong Import": 2 trainings, 2 sets'}));
    });

    it('reports skipped failed attempts in the summary', async () => {
      mockStrongCsvState.mockReturnValue(emptyState());
      mockedPickSingle.mockResolvedValue({uri: '/tmp/strong.csv', name: 'strong.csv', type: null, fileCopyUri: null, size: null});
      fileSaver.readFile.mockResolvedValue(strongCsv + '"2";"2024-01-03 18:00:00";"Pull";"3600";"Deadlift";"2";"250.0";"0";"";"";"";"";""\n');
      const {findByText, getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent.press(getByTestId('button-Import-from-Strong-CSV'));
      expect(await findByText('Skipped 1 failed attempt (0 reps), so it does not count as a record')).toBeTruthy();
      fireEvent.press(getByTestId('button-Import'));
      expect(mockStrongImport).toHaveBeenCalledWith(expect.objectContaining({setCount: 2, skippedFailedSets: 1}), {assumedWeightUnit: 'kg'});
    });

    it('keeps the import preview in sync with the data it will be imported into', async () => {
      mockedPickSingle.mockResolvedValue({uri: '/tmp/strong.csv', name: 'strong.csv', type: null, fileCopyUri: null, size: null});
      fileSaver.readFile.mockResolvedValue(strongCsv);
      const {getByTestId, findByText, getByText, rerender} = render(<SettingsTab navigation={navigation} route={route} />);
      fireEvent.press(getByTestId('button-Import-from-Strong-CSV'));
      expect(await findByText(/New plan "Strong Import",/)).toBeTruthy();

      // While the dialog is open, the data changes: the same file was imported meanwhile.
      const imported = rootReducer(emptyState() as any, {type: 'STRONG_IMPORT', parsed: parseStrongCsv(strongCsv), options: {}} as any);
      mockStrongCsvState.mockReturnValue(imported);
      rerender(<SettingsTab navigation={navigation} route={route} />);
      expect(getByText('Nothing new to import: all 2 workouts of this file are already in Gainalytics.')).toBeTruthy();

      // Another plan named "Strong Import" appears instead: the preview names the plan the reducer will create.
      const otherPlan = {...emptyState()} as any;
      otherPlan.trainingsPlan = {...otherPlan.trainingsPlan, byId: {7: {id: 7, name: 'Strong Import', trainings: {}, mesos: []}}, allIds: [7]};
      mockStrongCsvState.mockReturnValue(otherPlan);
      rerender(<SettingsTab navigation={navigation} route={route} />);
      expect(getByText(/New plan "Strong Import 2",/)).toBeTruthy();
      fireEvent.press(getByTestId('button-Import'));
      expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({text2: 'Plan "Strong Import 2": 2 trainings, 2 sets'}));
      expect(buildStrongImport(otherPlan, parseStrongCsv(strongCsv)).summary.planName).toBe('Strong Import 2');
    });

    it('disables the CSV export with a hint where no share sheet exists (iOS)', () => {
      delete nativeModulesWithShare.FileShare;
      mockStrongCsvState.mockReturnValue(stateWithOneSet());
      const {getByTestId, getByText} = render(<SettingsTab navigation={navigation} route={route} />);
      expect(getByText('Export as CSV is only available on Android for now.')).toBeTruthy();
      fireEvent.press(getByTestId('button-Export-as-CSV-(Strong-format)'));
      expect(fileSaver.writeFile).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
      // Import stays available.
      expect(getByTestId('button-Import-from-Strong-CSV')).toBeTruthy();
    });
  });

  it('renders model input with correct testID', async () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    // Expand the AI Config accordion first
    fireEvent.press(getByTestId('settings-ai-config-accordion'));

    await waitFor(() => {
      expect(getByTestId('settings-anthropic-model-input')).toBeTruthy();
    });
  });

  it('GH-504: without a provider choice shows the provider selector and the unchanged Claude key fields', () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId, queryByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('settings-ai-config-accordion'));

    expect(getByTestId('settings-ai-provider')).toBeTruthy();
    expect(getByTestId('settings-anthropic-api-key-input')).toBeTruthy();
    expect(getByTestId('settings-anthropic-model-input')).toBeTruthy();
    expect(queryByTestId('settings-chatgpt-section')).toBeNull();
  });

  it('GH-504: with ChatGPT selected shows the sign-in section instead of the API key, prompts stay', () => {
    mockUseAiProvider.mockReturnValue('chatgpt');
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId, queryByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('settings-ai-config-accordion'));

    expect(getByTestId('settings-chatgpt-section')).toBeTruthy();
    expect(queryByTestId('settings-anthropic-api-key-input')).toBeNull();
    expect(queryByTestId('settings-anthropic-model-input')).toBeNull();
    expect(getByTestId('settings-ai-chat-prompt-input')).toBeTruthy();
    mockUseAiProvider.mockReturnValue('claude');
  });

  it('saves custom model and shows success toast', async () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    // Expand the AI Config accordion first
    fireEvent.press(getByTestId('settings-ai-config-accordion'));

    await waitFor(() => {
      expect(getByTestId('button-Save-Model')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('settings-anthropic-model-input'), 'claude-opus-4-7');
    fireEvent.press(getByTestId('button-Save-Model'));

    expect(mockSetAnthropicModel).toHaveBeenCalledWith('claude-opus-4-7');
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      text1: 'Model saved',
    }));
  });

  it('resets to default and shows reset toast when model input is empty on save', async () => {
    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    // Expand the AI Config accordion first
    fireEvent.press(getByTestId('settings-ai-config-accordion'));

    await waitFor(() => {
      expect(getByTestId('button-Save-Model')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('settings-anthropic-model-input'), '');
    fireEvent.press(getByTestId('button-Save-Model'));

    expect(mockSetAnthropicModel).toHaveBeenCalledWith('');
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: 'info',
      text1: 'Reset to default model',
    }));
  });

  // Increase timeout: React 19 async batching can make waitFor take longer on first run
  it('renders exact alarm section and opens platform settings', async () => {
    mockedCanScheduleExactAlarms.mockResolvedValue(false);

    const navigation = createNavigation();
    const route = settingsRoute({});

    const {getAllByTestId, getByText} = render(<SettingsTab navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(getByText('Disabled - Notifications may be delayed')).toBeTruthy();
    });

    // The permission row is driven by a Switch, not a button; it is the last
    // one on the screen (1RM, imperial units, timer, toasts, exact alarm).
    const switches = getAllByTestId('settings-switch');
    fireEvent.press(switches[switches.length - 1]);

    await waitFor(() => {
      expect(mockedOpenExactAlarmSettings).toHaveBeenCalledTimes(1);
    });
  }, 25000);
});
