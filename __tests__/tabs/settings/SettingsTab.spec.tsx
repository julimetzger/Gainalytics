import React from 'react';
import {Alert, Platform} from 'react-native';
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
import {dispatchToggleShowPlusButtonLeft} from '../../../app/redux/settings/dispatch/dispatchToggleShowPlusButtonLeft';
import {dispatchToggleMode} from '../../../app/redux/settings/dispatch/dispatchToggleMode';
import {dispatchSetPalette} from '../../../app/redux/settings/dispatch/dispatchSetPalette';
import {dispatchSetExactAlarmPermission} from '../../../app/redux/settings/dispatch/dispatchSetExactAlarmPersmission';
import {canScheduleExactAlarms, openExactAlarmSettings} from '../../../app/utils/NotificationUtils';

const mockToggleMode = jest.fn();
const mockToggleDisable1RM = jest.fn();
const mockToggleShowTimer = jest.fn();
const mockToggleShowToasts = jest.fn();
const mockToggleShowPlusButtonLeft = jest.fn();
const mockSetPalette = jest.fn();
const mockSetExactAlarmPermission = jest.fn();
const mockFullImport = jest.fn();
const mockSetPauseTimer = jest.fn();
const mockSetFinishTrainingTimer = jest.fn();
const mockStoreGetState = jest.fn();

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

jest.mock('../../../app/redux/settings/dispatch/dispatchToggleShowPlusButtonLeft', () => ({
  dispatchToggleShowPlusButtonLeft: jest.fn(() => mockToggleShowPlusButtonLeft),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchToggleMode', () => ({
  dispatchToggleMode: jest.fn(() => mockToggleMode),
}));

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
    Text: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
    HelperText: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
    ActivityIndicator: () => <View testID="activity-indicator" />,
    TextInput: Object.assign(
      ({value, onChangeText, label, testID}: {value?: string; onChangeText?: (t: string) => void; label?: string; testID?: string; [k: string]: any}) => (
        <View testID={testID}>
          <Text>{label}</Text>
        </View>
      ),
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
const mockedDispatchToggleMode = jest.mocked(dispatchToggleMode);
const mockedDispatchToggleDisable1RM = jest.mocked(dispatchToggleDisable1RMpreselect);
const mockedDispatchToggleShowTimer = jest.mocked(dispatchToggleShowTimer);
const mockedDispatchToggleShowToasts = jest.mocked(dispatchToggleShowToasts);
const mockedDispatchToggleShowPlusButtonLeft = jest.mocked(dispatchToggleShowPlusButtonLeft);
const mockedDispatchSetPalette = jest.mocked(dispatchSetPalette);
const mockedDispatchSetExactAlarmPermission = jest.mocked(dispatchSetExactAlarmPermission);
const mockedDispatchFullImport = jest.mocked(dispatchFullImport);
const mockedDispatchSetPauseTimer = jest.mocked(dispatchSetPauseTimer);
const mockedDispatchSetFinishTrainingTimer = jest.mocked(dispatchSetFinishTrainingTimer);
const mockedCanScheduleExactAlarms = jest.mocked(canScheduleExactAlarms);
const mockedOpenExactAlarmSettings = jest.mocked(openExactAlarmSettings);
const mockedPickSingle = jest.mocked(DocumentPicker.pickSingle);

describe('SettingsTab', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {value: 'android', configurable: true});
    Object.defineProperty(Platform, 'Version', {value: 33, configurable: true});

    mockedUseSettings.mockReturnValue({
      mode: 'light',
      palette: 'blue',
      toggles: {
        disable1RMButton: false,
        showPlusButtonLeft: true,
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

    mockedDispatchToggleMode.mockClear();
    mockedDispatchToggleDisable1RM.mockClear();
    mockedDispatchToggleShowTimer.mockClear();
    mockedDispatchToggleShowToasts.mockClear();
    mockedDispatchToggleShowPlusButtonLeft.mockClear();
    mockedDispatchSetPalette.mockClear();
    mockedDispatchSetExactAlarmPermission.mockClear();
    mockedDispatchFullImport.mockClear();
    mockedDispatchSetPauseTimer.mockClear();
    mockedDispatchSetFinishTrainingTimer.mockClear();

    mockToggleMode.mockReset();
    mockToggleDisable1RM.mockReset();
    mockToggleShowTimer.mockReset();
    mockToggleShowToasts.mockReset();
    mockToggleShowPlusButtonLeft.mockReset();
    mockSetPalette.mockReset();
    mockSetExactAlarmPermission.mockReset();
    mockFullImport.mockReset();
    mockSetPauseTimer.mockReset();
    mockSetFinishTrainingTimer.mockReset();

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

  it('dispatches switch toggles and palette changes', async () => {
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
    fireEvent.press(switches[4]);
    fireEvent.press(switches[5]);

    fireEvent.press(getByTestId('radio-green'));

    expect(mockToggleMode).toHaveBeenCalledTimes(1);
    expect(mockToggleDisable1RM).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Nope. This app is not using stupid measuring systems.');
    expect(mockToggleShowPlusButtonLeft).toHaveBeenCalledTimes(1);
    expect(mockToggleShowTimer).toHaveBeenCalledTimes(1);
    expect(mockToggleShowToasts).toHaveBeenCalledTimes(1);
    expect(mockSetPalette).toHaveBeenCalledWith('green');
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

  it('exports data into file system and shows exported path', () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    fireEvent.press(getByTestId('button-Export-Data'));

    expect(fileSaver.writeFile).toHaveBeenCalledWith('/mock/path/1234.gains', '{"training":"state"}');
    expect(Alert.alert).toHaveBeenCalledWith('exported to /mock/path/1234.gains');
  });

  it('renders exact alarm section and opens platform settings', async () => {
    mockedCanScheduleExactAlarms.mockResolvedValue(false);

    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<SettingsTab navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(getByTestId('button-Enable')).toBeEnabled();
    });

    fireEvent.press(getByTestId('button-Enable'));

    await waitFor(() => {
      expect(mockedOpenExactAlarmSettings).toHaveBeenCalledTimes(1);
    });
  });
});
