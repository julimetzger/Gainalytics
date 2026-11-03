import React from 'react';
import {act, render} from '@testing-library/react-native';
import {DatePickerModal} from '../../../../app/components/picker/date/DatePickerModal';
import {NullableRange} from '../../../../app/components/picker/date/NullableRange';
import {useWorkoutsIn} from '../../../../app/redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../../../app/models/entities/Workout';

const mockCalendarPropsRef: {current: Record<string, unknown> | undefined} = {current: undefined};

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
    SwipeDirection: {LEFT: 'left', RIGHT: 'right'},
  };
});

jest.mock('../../../../app/redux/Workout/use/useWorkoutsIn', () => ({
  useWorkoutsIn: jest.fn(),
}));

jest.mock('react-native-calendars/src', () => ({
  CalendarList: (props: Record<string, unknown>) => {
    const React = require('react');
    const {View} = require('react-native');
    mockCalendarPropsRef.current = props;
    return <View testID="calendar-list" />;
  },
}));

jest.mock('react-native-paper', () => {
  // one theme object like Paper's provider, so memoized values can stay stable across renders
  const theme = {
    colors: {
      background: '#f5f5f5',
      onBackground: '#101010',
      primary: '#0055ff',
      onPrimary: '#ffffff',
      primaryContainer: '#dbe6ff',
      onPrimaryContainer: '#001133',
    },
  };
  return {useTheme: () => theme};
});

const mockedUseWorkoutsIn = jest.mocked(useWorkoutsIn);

function getRequiredCalendarProp(key: string): unknown {
  const currentProps = mockCalendarPropsRef.current;
  if (!currentProps || !(key in currentProps)) {
    throw new Error(`Missing calendar prop: ${key}`);
  }
  return currentProps[key];
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

describe('DatePickerModal', () => {
  beforeEach(() => {
    const workouts: Workout[] = [
      {
        id: 1,
        exerciseId: 10,
        sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
        start: new Date(2024, 0, 5),
      },
      {
        id: 2,
        exerciseId: 10,
        sets: [{index: 1, reps: 4, rir: 2, weight: 90}],
        start: new Date(2024, 0, 6),
      },
      {
        id: 3,
        exerciseId: 10,
        sets: [{index: 1, reps: 3, rir: 1, weight: 80}],
        start: new Date(2024, 0, 6),
      },
    ];

    mockedUseWorkoutsIn.mockReturnValue(workouts);
    mockCalendarPropsRef.current = undefined;
  });

  it('emits selected day changes for single-date mode', () => {
    const onChange = jest.fn();

    render(<DatePickerModal date={new Date(2024, 0, 5)} onChange={onChange} />);

    const onDayPress = getRequiredCalendarProp('onDayPress');
    if (typeof onDayPress !== 'function') {
      throw new Error('Expected onDayPress to be a function');
    }

    act(() => {
      onDayPress({dateString: '2024-01-07'});
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(new Date('2024-01-07'));
  });

  it('sets end date when range has a start but no end', () => {
    const onChange = jest.fn();

    render(<DatePickerModal date={new NullableRange(new Date('2024-01-03'), undefined)} onChange={onChange} />);

    const onDayPress = getRequiredCalendarProp('onDayPress');
    if (typeof onDayPress !== 'function') {
      throw new Error('Expected onDayPress to be a function');
    }

    act(() => {
      onDayPress({dateString: '2024-01-10'});
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(new NullableRange(new Date('2024-01-03'), new Date('2024-01-10')));
  });

  it('resets range start when selecting an earlier day than current start', () => {
    const onChange = jest.fn();

    render(<DatePickerModal date={new NullableRange(new Date('2024-01-10'), new Date('2024-01-20'))} onChange={onChange} />);

    const onDayPress = getRequiredCalendarProp('onDayPress');
    if (typeof onDayPress !== 'function') {
      throw new Error('Expected onDayPress to be a function');
    }

    act(() => {
      onDayPress({dateString: '2024-01-05'});
    });

    const expected = new NullableRange(new Date('2024-01-05'), undefined);
    const lastCallArgument = onChange.mock.calls[onChange.mock.calls.length - 1][0];

    expect(lastCallArgument).toEqual(expected);
  });

  it('marks start, end, the days in between and the training days of a range', () => {
    render(<DatePickerModal date={new NullableRange(new Date(2024, 0, 5), new Date(2024, 0, 8))} onChange={jest.fn()} />);

    expect(getRequiredCalendarProp('markedDates')).toEqual({
      '2024-01-05': {color: '#0055ff', startingDay: true, marked: true, dotColor: '#ffffff'},
      '2024-01-06': {color: '#dbe6ff', marked: true, dotColor: '#001133'},
      '2024-01-07': {color: '#dbe6ff'},
      '2024-01-08': {color: '#0055ff', endingDay: true},
    });
  });

  // GH-673: the dialog re-renders with a new but equal range on open and on Save. Stable props let
  // the calendar months and their memoized day cells skip those renders.
  it('keeps markings, theme and day handler when re-rendered with an equal range', () => {
    const onChange = jest.fn();
    const {rerender} = render(<DatePickerModal date={new NullableRange(new Date(2024, 0, 5), new Date(2024, 0, 8))} onChange={onChange} />);
    const first = {...mockCalendarPropsRef.current};

    rerender(<DatePickerModal date={new NullableRange(new Date(2024, 0, 5), new Date(2024, 0, 8))} onChange={onChange} />);

    expect(getRequiredCalendarProp('markedDates')).toBe(first.markedDates);
    expect(getRequiredCalendarProp('theme')).toBe(first.theme);
    expect(getRequiredCalendarProp('onDayPress')).toBe(first.onDayPress);
    expect(getRequiredCalendarProp('onVisibleMonthsChange')).toBe(first.onVisibleMonthsChange);
  });

  it('marks selected and workout dates in single-date mode', () => {
    const onChange = jest.fn();

    render(<DatePickerModal date={new Date(2024, 0, 5)} onChange={onChange} />);

    const markedDatesValue = getRequiredCalendarProp('markedDates');
    if (!isStringRecord(markedDatesValue)) {
      throw new Error('Expected markedDates to be an object');
    }
    const markedDates = markedDatesValue;

    expect(markedDates).toHaveProperty('2024-01-05');
    expect(markedDates?.['2024-01-05']).toEqual({selectedColor: '#0055ff', selected: true});
    expect(markedDates?.['2024-01-06']).toEqual({marked: true});
  });
});
