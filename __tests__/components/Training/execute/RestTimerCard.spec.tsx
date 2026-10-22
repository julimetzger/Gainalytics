import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import RestTimerCard from '../../../../app/components/Training/execute/RestTimerCard';

jest.mock('react-native-svg', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: ({children, testID}: any) => <View testID={testID}>{children}</View>,
    Svg: ({children, testID}: any) => <View testID={testID}>{children}</View>,
    Circle: ({testID}: any) => <View testID={testID} />,
  };
});

jest.mock('../../../../app/utils/restTimer', () => ({
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

describe('RestTimerCard caption (GH-394)', () => {
  const renderCard = () =>
    render(
      <RestTimerCard
        startedAt={Date.now()}
        targetSeconds={90}
        exerciseId={7}
        onReset={jest.fn()}
        onSkip={jest.fn()}
        onEditTarget={jest.fn()}
      />,
    );

  it('shows only the target, never a second elapsed/remaining readout', () => {
    const {getByTestId, queryByTestId} = renderCard();

    expect(getByTestId('rest-timer-target').props.children).toBe('target 01:30');
    // The old duplicate line is gone; the running time lives in the ring only.
    expect(queryByTestId('rest-timer-elapsed')).toBeNull();
  });

  it('still renders the live time inside the progress ring', () => {
    const {getByTestId} = renderCard();

    // useRestTimer is mocked to a counting snapshot with display '01:00'.
    expect(getByTestId('rest-progress-ring-text').props.children).toBe('01:00');
  });
});

describe('RestTimerCard overflow menu labels (GH-543)', () => {
  const renderCard = () =>
    render(
      <RestTimerCard
        startedAt={Date.now()}
        targetSeconds={90}
        exerciseId={7}
        onReset={jest.fn()}
        onSkip={jest.fn()}
        onEditTarget={jest.fn()}
        onAdjustExerciseDefault={jest.fn()}
      />,
    );

  it('uses Title Case labels that match the dialog titles they open', () => {
    const {getByTestId, getByText} = renderCard();
    fireEvent.press(getByTestId('rest-timer-overflow'));

    expect(getByText('Skip Rest')).toBeTruthy();
    expect(getByText('Edit Rest Target…')).toBeTruthy();
    expect(getByText('Adjust Default Rest…')).toBeTruthy();
  });

  it.each([
    ['rest-timer-edit-target-menu', 'Edit Rest Target'],
    ['rest-timer-adjust-default', 'Adjust Default Rest'],
  ])('menu item %s opens the dialog titled "%s"', (itemTestID, dialogTitle) => {
    const {getByTestId, getByText} = renderCard();
    fireEvent.press(getByTestId('rest-timer-overflow'));
    fireEvent.press(getByTestId(itemTestID));

    expect(getByText(dialogTitle)).toBeTruthy();
  });
});

describe('RestTimerCard "Adjust Default Rest…" (GH-195 P2)', () => {
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
    // Tap "Adjust Default Rest…".
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
