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

jest.mock('react-redux', () => ({
  useStore: jest.fn(),
}));

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
        <Text>Custom Color</Text>
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
    HelperText: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
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
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

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
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getAllByTestId, getByTestId, queryByText} = render(<SettingsTab navigation={navigation} route={route} />);

    const titles = getAllByTestId(/^settings-section-[a-z-]+-title$/).map((node) => node.props.children);
    expect(titles).toEqual(['Appearance', 'General', 'Timers & Notifications', 'AI Coach', 'Help', 'Data']);

    // GH-478: the Theme row and the single "Custom Color" row share one section.
    expect(getByTestId('settings-section-theme')).toContainElement(getByTestId('settings-theme-mode-row'));
    expect(getByTestId('settings-section-theme')).toContainElement(getByTestId('settings-theme-palette-row'));
    expect(queryByText('Color Palette')).toBeNull();
    expect(queryByText('Theme Color')).toBeNull();
    expect(queryByText('Enable Dark Mode')).toBeNull();
  });

  it('imports data through the dialog and dispatches full import', async () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

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
    const navigation = {setOptions: jest.fn(), navigate: jest.fn(), setParams: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('button-Show-Introduction'));

    expect(mockShowOnboarding).toHaveBeenCalledTimes(1);
  });

  it('opens the import confirmation when the onboarding asks for it (GH-497)', () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn(), setParams: jest.fn()};
    const route = {params: {openImport: true}};

    const {getByText} = render(<SettingsTab navigation={navigation} route={route} />);

    expect(getByText('Import full data from backup file?')).toBeTruthy();
    expect(navigation.setParams).toHaveBeenCalledWith({openImport: undefined});
  });

  it('renders the app version supplied by the native build', () => {
    nativeModulesWithAppInfo.AppInfo = {versionName: '9.8.7'};
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    expect(getByTestId('settings-app-version')).toHaveTextContent('Version 9.8.7');
  });

  it('exports data into file system and shows exported path', () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    fireEvent.press(getByTestId('button-Export-Data'));

    expect(fileSaver.writeFile).toHaveBeenCalledWith('/mock/path/1234.gains', '{"training":"state"}');
    expect(Alert.alert).toHaveBeenCalledWith('exported to /mock/path/1234.gains');
  });

  it('renders model input with correct testID', async () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    // Expand the AI Config accordion first
    fireEvent.press(getByTestId('settings-ai-config-accordion'));

    await waitFor(() => {
      expect(getByTestId('settings-anthropic-model-input')).toBeTruthy();
    });
  });

  it('saves custom model and shows success toast', async () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

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
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

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

    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

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
