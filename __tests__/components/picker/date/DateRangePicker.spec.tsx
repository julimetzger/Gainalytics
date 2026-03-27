import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import DateRangePicker, {Range} from '../../../../app/components/picker/date/DateRangePicker';
import {NullableRange} from '../../../../app/components/picker/date/NullableRange';

// Capture props injected into mocked child components so tests can interact
// with them without knowing internal structure.
const mockDatePickerModalRef: {current: {date: NullableRange; onChange: (r: NullableRange) => void} | undefined} = {current: undefined};
const mockStartInputRef: {current: {value: Date | undefined; onChange: (d: Date | undefined) => void} | undefined} = {current: undefined};
const mockEndInputRef: {current: {value: Date | undefined; onChange: (d: Date | undefined) => void} | undefined} = {current: undefined};

jest.mock('../../../../app/components/picker/date/DatePickerModal', () => ({
  DatePickerModal: (props: {date: NullableRange; onChange: (r: NullableRange) => void}) => {
    const {View} = require('react-native');
    mockDatePickerModalRef.current = props;
    return <View testID="date-picker-modal" />;
  },
}));

jest.mock('react-native-paper-dates', () => ({
  DatePickerInput: (props: {value: Date | undefined; onChange: (d: Date | undefined) => void; inputMode: string}) => {
    const {View} = require('react-native');
    if (props.inputMode === 'start') {
      mockStartInputRef.current = {value: props.value, onChange: props.onChange};
      return <View testID="start-input" />;
    }
    if (props.inputMode === 'end') {
      mockEndInputRef.current = {value: props.value, onChange: props.onChange};
      return <View testID="end-input" />;
    }
    return <View />;
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    Swipeable: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
  };
});

jest.mock('../../../../app/utils/DateHelper', () => ({
  getDateStringFromDate: (d: Date) => (d ? d.toISOString().slice(0, 10) : ''),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {TouchableOpacity, Text, View} = require('react-native');
  return {
    Button: ({children, onPress, mode}: {children: React.ReactNode; onPress?: () => void; mode?: string}) => (
      <TouchableOpacity testID={`button-${String(children).replace(/\s+/g, '-')}-${mode ?? 'default'}`} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Icon: () => <View />,
    Modal: ({visible, children}: {visible: boolean; children: React.ReactNode; onDismiss?: () => void; contentContainerStyle?: object}) =>
      visible ? <>{children}</> : null,
    Portal: ({children}: {children: React.ReactNode}) => <>{children}</>,
  };
});

const JAN_10 = new Date('2024-01-10T00:00:00.000Z');
const JAN_20 = new Date('2024-01-20T00:00:00.000Z');
const JAN_5 = new Date('2024-01-05T00:00:00.000Z');
const JAN_25 = new Date('2024-01-25T00:00:00.000Z');

function setup(setRange = jest.fn()) {
  const initialRange = new Range(JAN_10, JAN_20);
  const result = render(<DateRangePicker range={initialRange} setRange={setRange} />);
  // Open the modal
  fireEvent.press(result.getByTestId('button-2024-01-10-to-2024-01-20-outlined'));
  return {result, setRange, initialRange};
}

describe('DateRangePicker', () => {
  beforeEach(() => {
    mockDatePickerModalRef.current = undefined;
    mockStartInputRef.current = undefined;
    mockEndInputRef.current = undefined;
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-03-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('single-day calendar tap sets start date; Save falls back to today as end date', () => {
    const setRange = jest.fn();
    setup(setRange);

    // Simulate calendar emitting a single-day selection (only startDate, no endDate)
    act(() => {
      mockDatePickerModalRef.current?.onChange(new NullableRange(JAN_5, undefined));
    });

    // Press Save without selecting an end date
    const {result} = setup(setRange);
    // re-open after state settled
    act(() => {
      mockDatePickerModalRef.current?.onChange(new NullableRange(JAN_5, undefined));
    });

    // Find and press Save button
    const saveButton = result.getByTestId('button-Save-elevated');
    fireEvent.press(saveButton);

    expect(setRange).toHaveBeenCalled();
    const calledWith: Range = setRange.mock.calls[setRange.mock.calls.length - 1][0];
    expect(calledWith).toBeInstanceOf(Range);
    expect(calledWith.startDate).toEqual(JAN_5);
    // endDate should be today (2024-03-15) since no end was selected
    expect(calledWith.endDate.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('calendar start+end selection syncs to text inputs', () => {
    setup();

    // Calendar selects a full range
    act(() => {
      mockDatePickerModalRef.current?.onChange(new NullableRange(JAN_5, JAN_25));
    });

    // Start and end inputs should now reflect the pending uncompleteRange
    expect(mockStartInputRef.current?.value).toEqual(JAN_5);
    expect(mockEndInputRef.current?.value).toEqual(JAN_25);
  });

  it('input editing is reflected in the confirmed range (no stale-closure overwrite)', () => {
    const setRange = jest.fn();
    const {result} = setup(setRange);

    // Calendar selects a full range (calendarEndSelectedRef = true)
    act(() => {
      mockDatePickerModalRef.current?.onChange(new NullableRange(JAN_5, JAN_25));
    });

    // User edits the start input — functional update must apply on top of latest state
    act(() => {
      mockStartInputRef.current?.onChange(new Date('2024-01-03T00:00:00.000Z'));
    });

    // Press Save — start must reflect the text-input edit; end comes from calendar
    fireEvent.press(result.getByTestId('button-Save-elevated'));

    expect(setRange).toHaveBeenCalledTimes(1);
    const calledWith: Range = setRange.mock.calls[0][0];
    expect(calledWith.startDate).toEqual(new Date('2024-01-03T00:00:00.000Z'));
    expect(calledWith.endDate).toEqual(JAN_25);
  });

  it('single-day tap then end-input edit: Save uses today, not the typed end date', () => {
    const setRange = jest.fn();
    const {result} = setup(setRange);

    // Calendar single-day tap (calendarEndSelectedRef = false)
    act(() => {
      mockDatePickerModalRef.current?.onChange(new NullableRange(JAN_5, undefined));
    });

    // User types an end date in the text input
    act(() => {
      mockEndInputRef.current?.onChange(JAN_25);
    });

    // Press Save — reviewer requires today to be used, not the typed end date
    fireEvent.press(result.getByTestId('button-Save-elevated'));

    expect(setRange).toHaveBeenCalledTimes(1);
    const calledWith: Range = setRange.mock.calls[0][0];
    expect(calledWith.startDate).toEqual(JAN_5);
    // End date must be today (2024-03-15), not the typed JAN_25
    expect(calledWith.endDate.toISOString().slice(0, 10)).toBe('2024-03-15');
  });

  it('calendar remains responsive after a text-input Save (no stale instanceof breakage)', () => {
    const setRange = jest.fn();
    const {result} = setup(setRange);

    // User edits both text inputs (no prior calendar tap)
    act(() => {
      mockStartInputRef.current?.onChange(new Date('2024-01-03T00:00:00.000Z'));
    });
    act(() => {
      mockEndInputRef.current?.onChange(JAN_25);
    });

    // Press Save — applies the text-input range
    fireEvent.press(result.getByTestId('button-Save-elevated'));
    expect(setRange).toHaveBeenCalledTimes(1);

    // The DatePickerModal prop must still be a NullableRange instance so the
    // calendar's extracted() can respond to day taps.
    // After the text-input edits the uncompleteRange must remain a NullableRange.
    expect(mockDatePickerModalRef.current?.date).toBeInstanceOf(NullableRange);
  });

  it('Save with both start and end selected applies the confirmed range', () => {
    const setRange = jest.fn();
    const {result} = setup(setRange);

    act(() => {
      mockDatePickerModalRef.current?.onChange(new NullableRange(JAN_5, JAN_25));
    });

    fireEvent.press(result.getByTestId('button-Save-elevated'));

    expect(setRange).toHaveBeenCalledTimes(1);
    const calledWith: Range = setRange.mock.calls[0][0];
    expect(calledWith.startDate).toEqual(JAN_5);
    expect(calledWith.endDate).toEqual(JAN_25);
  });
});
