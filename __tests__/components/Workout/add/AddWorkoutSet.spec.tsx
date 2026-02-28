import React from 'react';
import {Keyboard, TouchableOpacity, View} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import AddWorkoutSet from '../../../../app/components/Workout/add/AddWorkoutSet';
import {useSettings} from '../../../../app/redux/settings/use/useSettings';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {TextInput, Text, TouchableOpacity, View} = require('react-native');

  return {
    Button: ({children, onPress}: {children: string; onPress?: () => void}) => (
      <TouchableOpacity testID={`button-${children}`} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    IconButton: ({icon, onPress}: {icon: string; onPress?: () => void}) => (
      <TouchableOpacity testID={`icon-button-${icon}`} onPress={onPress}>
        <Text>{icon}</Text>
      </TouchableOpacity>
    ),
    Text: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
    TextInput: ({label, onChangeText, ...rest}: {label: string; onChangeText?: (value: string) => void} & Record<string, unknown>) => (
      <TextInput accessibilityLabel={label} onChangeText={onChangeText} {...rest} />
    ),
    ToggleButton: ({status, onPress}: {status: 'checked' | 'unchecked'; onPress?: () => void}) => (
      <TouchableOpacity testID="toggle-button" onPress={onPress}>
        <Text testID="toggle-status">{status}</Text>
      </TouchableOpacity>
    ),
    Tooltip: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
    useTheme: () => ({
      colors: {
        primary: '#000000',
        onPrimary: '#ffffff',
      },
    }),
  };
});

const mockedUseSettings = jest.mocked(useSettings);

describe('AddWorkoutSet', () => {
  beforeEach(() => {
    mockedUseSettings.mockReturnValue({
      toggles: {
        disable1RMButton: false,
      },
    });
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validates required fields and does not submit empty values', () => {
    const onSubmit = jest.fn();

    const {getByTestId} = render(<AddWorkoutSet onSubmit={onSubmit} />);

    fireEvent.press(getByTestId('button-Add'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a full payload for a new set', () => {
    const onSubmit = jest.fn();
    const submitDate = new Date('2024-01-03T12:00:00.000Z');

    const {getByLabelText, getByTestId} = render(<AddWorkoutSet onSubmit={onSubmit} date={submitDate} />);

    fireEvent.changeText(getByLabelText('Reps'), '8');
    fireEvent.changeText(getByLabelText('RIR'), '2');
    fireEvent.changeText(getByLabelText('Weight'), '100,5');
    fireEvent.press(getByTestId('button-Add'));

    const expected: WorkoutSet = {
      index: undefined,
      date: submitDate,
      weight: 100.5,
      reps: 8,
      rir: 2,
    };

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expected);
  });

  it('auto-submits persisted set changes on blur when manual save is disabled', () => {
    const onSubmit = jest.fn();
    const submitDate = new Date('2024-02-01T10:00:00.000Z');
    const workoutSet: WorkoutSet = {
      index: 2,
      date: new Date('2024-01-01T10:00:00.000Z'),
      reps: 5,
      rir: 1,
      weight: 120,
    };

    const {getByLabelText} = render(<AddWorkoutSet onSubmit={onSubmit} workoutSet={workoutSet} date={submitDate} />);

    const repsInput = getByLabelText('Reps');
    fireEvent.changeText(repsInput, '9');
    fireEvent(repsInput, 'blur');

    const expected: WorkoutSet = {
      index: 2,
      date: submitDate,
      weight: 120,
      reps: 9,
      rir: 1,
    };

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expected);
  });

  it('calculates 1RM suggested weight and toggles 1RM button state', () => {
    const onSubmit = jest.fn();

    const {getByLabelText, getByTestId} = render(<AddWorkoutSet onSubmit={onSubmit} oneRepMax={100} />);

    fireEvent.changeText(getByLabelText('Reps'), '5');

    const weightInput = getByLabelText('Weight');
    expect(weightInput.props.value).toBe('86');

    expect(getByTestId('toggle-status').props.children).toBe('checked');
    fireEvent.press(getByTestId('toggle-button'));
    expect(getByTestId('toggle-status').props.children).toBe('unchecked');
  });

  it('calls delete callback with the current workout set', () => {
    const onSubmit = jest.fn();
    const onDelete = jest.fn();
    const workoutSet: WorkoutSet = {
      index: 1,
      date: new Date('2024-01-01T00:00:00.000Z'),
      reps: 3,
      rir: 0,
      weight: 140,
    };

    const {getByTestId} = render(<AddWorkoutSet onSubmit={onSubmit} workoutSet={workoutSet} onDelete={onDelete} />);

    fireEvent.press(getByTestId('icon-button-delete'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(workoutSet);
  });
});
