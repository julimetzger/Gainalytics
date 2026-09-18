/**
 * GH-443 — what the user actually READS on the rest timer while a logged set is
 * corrected.
 *
 * The other GH-443 tests pin the trigger (`isExistingSet` → no START_REST_TIMER).
 * This one closes the loop on the display: with the real `useRestTimer` and a
 * driven clock it asserts the digits inside the progress ring, so a regression
 * that reset the timer would have to show up as a jump back to the target.
 */
import React from 'react';
import {act, render} from '@testing-library/react-native';
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
    useTheme: () => ({colors: {primary: '#000', error: '#f00', surface: '#fff', onSurface: '#000', surfaceVariant: '#eee', onSurfaceVariant: '#666'}}),
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

const T0 = 1_700_000_000_000;
const TARGET = 90;

describe('RestTimerCard — the displayed time across a set correction (GH-443)', () => {
  // Modern fake timers move Date.now() along with the interval, so the card sees
  // exactly the wall time the ticks claim.
  const advance = (seconds: number) => {
    act(() => {
      jest.advanceTimersByTime(seconds * 1000);
    });
  };

  const card = (startedAt: number) => (
    <RestTimerCard
      startedAt={startedAt}
      targetSeconds={TARGET}
      exerciseId={7}
      onReset={jest.fn()}
      onSkip={jest.fn()}
      onEditTarget={jest.fn()}
    />
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps counting down when the set correction leaves startedAt alone', () => {
    const {getByTestId, rerender} = render(card(T0));
    const shown = () => getByTestId('rest-progress-ring-text').props.children;

    expect(shown()).toBe('01:30');

    advance(18);
    expect(shown()).toBe('01:12');

    // The correction: the same rest is still running, so the card is re-rendered
    // with the very same time base. The user must NOT see 01:30 again.
    rerender(card(T0));
    expect(shown()).toBe('01:12');

    advance(14);
    expect(shown()).toBe('00:58');
  });

  it('shows the full target again when a NEW set restarts the rest', () => {
    const {getByTestId, rerender} = render(card(T0));
    const shown = () => getByTestId('rest-progress-ring-text').props.children;

    advance(18);
    expect(shown()).toBe('01:12');

    // A new set dispatches START_REST_TIMER with a fresh startedAt.
    rerender(card(Date.now()));
    expect(shown()).toBe('01:30');
  });

  it('the target caption is untouched by either case', () => {
    const {getByTestId, rerender} = render(card(T0));

    expect(getByTestId('rest-timer-target').props.children).toBe('target 01:30');
    advance(18);
    rerender(card(T0));
    expect(getByTestId('rest-timer-target').props.children).toBe('target 01:30');
  });
});
