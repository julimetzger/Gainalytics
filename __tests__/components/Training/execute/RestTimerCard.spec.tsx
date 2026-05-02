import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import RestTimerCard from '../../../../app/components/Training/execute/RestTimerCard';

jest.mock('../../../../app/utils/restTimer', () => ({
  formatElapsedSecondary: jest.fn(() => '-00:30'),
  formatTarget: jest.fn(() => '01:30'),
  useRestTimer: jest.fn(() => ({display: '01:00', state: 'counting', elapsedSeconds: 30})),
  useVibrationOnRestEvents: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');
  const Menu: any = ({children, anchor, visible}: any) => (
    <View>
      {anchor}
      {visible ? <View testID="menu-content">{children}</View> : null}
    </View>
  );
  Menu.Item = ({title, onPress, testID}: any) => (
    <TouchableOpacity testID={testID} onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
  return {
    useTheme: () => ({colors: {primary: '#000', error: '#f00', surface: '#fff', onSurface: '#000', surfaceVariant: '#eee', onSurfaceVariant: '#666', secondaryContainer: '#ddd', onSecondaryContainer: '#000', secondary: '#888'}}),
    Button: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}><Text>{children}</Text></TouchableOpacity>
    ),
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}><Text>icon</Text></TouchableOpacity>
    ),
    Menu,
    Text: ({children, style, testID}: any) => <Text testID={testID} style={style}>{children}</Text>,
    Portal: ({children}: any) => <View>{children}</View>,
    Dialog: Object.assign(
      ({children, visible, testID}: any) => (visible ? <View testID={testID}>{children}</View> : null),
      {
        Title: ({children}: any) => <Text>{children}</Text>,
        Content: ({children}: any) => <View>{children}</View>,
        Actions: ({children}: any) => <View>{children}</View>,
      },
    ),
    Checkbox: ({onPress, testID, status}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}><Text>{status}</Text></TouchableOpacity>
    ),
    TextInput: ({label, onChangeText, value, testID}: any) => (
      <TextInput testID={testID} accessibilityLabel={label} onChangeText={onChangeText} value={value} />
    ),
  };
});

describe('RestTimerCard "Adjust default for this exercise" (GH-195 P2)', () => {
  it('opens the dialog pre-populated with exerciseDefaultSeconds and persists via onAdjustExerciseDefault on save', () => {
    const onAdjustExerciseDefault = jest.fn();
    const {getByTestId} = render(
      <RestTimerCard
        startedAt={Date.now()}
        targetSeconds={90}
        exerciseId={7}
        exerciseDefaultSeconds={60}
        onReset={jest.fn()}
        onSkip={jest.fn()}
        onEditTarget={jest.fn()}
        onAdjustExerciseDefault={onAdjustExerciseDefault}
      />,
    );

    // Open overflow menu.
    fireEvent.press(getByTestId('rest-timer-overflow'));
    // Tap "Adjust default for this exercise".
    fireEvent.press(getByTestId('rest-timer-adjust-default'));

    // Dialog opens pre-populated with the current per-exercise default (60s = 1:00).
    expect(getByTestId('rest-target-minutes').props.value).toBe('1');
    expect(getByTestId('rest-target-seconds').props.value).toBe('00');
    // Hint replaces the optional checkbox.
    expect(getByTestId('rest-target-exercise-default-hint')).toBeTruthy();

    // User changes to 2:00 and saves.
    fireEvent.changeText(getByTestId('rest-target-minutes'), '2');
    fireEvent.changeText(getByTestId('rest-target-seconds'), '0');
    fireEvent.press(getByTestId('rest-target-save'));

    // The handler is called with the new seconds — never a no-op.
    expect(onAdjustExerciseDefault).toHaveBeenCalledWith(120);
  });

  it('falls back to the active targetSeconds when no exercise default is set', () => {
    const onAdjustExerciseDefault = jest.fn();
    const {getByTestId} = render(
      <RestTimerCard
        startedAt={Date.now()}
        targetSeconds={90}
        exerciseId={7}
        onReset={jest.fn()}
        onSkip={jest.fn()}
        onEditTarget={jest.fn()}
        onAdjustExerciseDefault={onAdjustExerciseDefault}
      />,
    );
    fireEvent.press(getByTestId('rest-timer-overflow'));
    fireEvent.press(getByTestId('rest-timer-adjust-default'));
    // Pre-populated with the active target (90s = 1:30).
    expect(getByTestId('rest-target-minutes').props.value).toBe('1');
    expect(getByTestId('rest-target-seconds').props.value).toBe('30');
  });
});
