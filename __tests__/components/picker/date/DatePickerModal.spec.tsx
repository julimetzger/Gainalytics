import React from 'react';
import {act, render} from '@testing-library/react-native';
import {DatePickerModal} from '../../../../app/components/picker/date/DatePickerModal';
import {NullableRange} from '../../../../app/components/picker/date/NullableRange';
import {useWorkoutsIn} from '../../../../app/redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../../../app/models/entities/Workout';

const mockCalendarPropsRef: {current: Record<string, unknown> | undefined} = {current: undefined};

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    Swipeable: ({children}: {children: React.ReactNode}) => <View>{children}</View>,
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

jest.mock('react-native-paper', () => ({
  useTheme: () => ({
    colors: {
      background: '#f5f5f5',
      onBackground: '#101010',
      primary: '#0055ff',
      onPrimary: '#ffffff',
      primaryContainer: '#dbe6ff',
      onPrimaryContainer: '#001133',
    },
  }),
}));

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
