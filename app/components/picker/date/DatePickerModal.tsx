import {getDaysBetween, getEndOfMonth, getFirstDayOfMonth, getYYYYMMDDFormat, subtractMonths} from '../../../utils/DateHelper';
import * as React from 'react';
import {useCallback, useMemo, useState} from 'react';
import {useWorkoutsIn} from '../../../redux/Workout/use/useWorkoutsIn';
import {MD3Theme, useTheme} from 'react-native-paper';
import {Range} from './DateRangePicker';
import {DateData} from 'react-native-calendars';
import {CalendarList} from 'react-native-calendars/src';
import {MarkedDates} from 'react-native-calendars/src/types';
import {NullableRange} from './NullableRange';

type DateOrRange = Date | NullableRange;

interface DatePickerModalProps<T extends DateOrRange> {
  date: T;
  onChange: (arg: T) => void;
}

type Colors = MD3Theme['colors'];

/** Period start/end, the days in between and the training days (dots) of a range selection. */
function rangeMarkedDates(startDate: Date | undefined, endDate: Date | undefined, workoutDates: string[], colors: Colors): MarkedDates {
  let highlightedDates: MarkedDates = {};
  const start = startDate ? getYYYYMMDDFormat(startDate) : undefined;
  const end = endDate ? getYYYYMMDDFormat(endDate) : undefined;
  let periodDays: Set<string> | undefined;

  if (start) {
    highlightedDates[start] = {color: colors.primary, startingDay: true};
  }
  if (end) {
    highlightedDates[end] = {color: colors.primary, endingDay: true};
  }
  if (startDate && endDate && start && end) {
    // GH-673: a Set instead of Array.includes — the old lookup ran once per training day over every day of the range.
    periodDays = new Set(getDaysBetween(startDate, endDate).map((day) => getYYYYMMDDFormat(day)));
    const daysBetween = Object.fromEntries(
      Array.from(periodDays)
        .filter((day) => day !== start && day !== end)
        .map((day) => [day, {color: colors.primaryContainer}]),
    );
    highlightedDates = {...highlightedDates, ...daysBetween};
  }

  const trainingDays = Object.fromEntries(
    Array.from(new Set(workoutDates)).map((day) => {
      if (start && start === day) {
        return [day, {color: colors.primary, startingDay: true, marked: true, dotColor: colors.onPrimary}];
      }
      if (end && end === day) {
        return [day, {color: colors.primary, endingDay: true, dotColor: colors.onPrimary}];
      }
      if (periodDays && periodDays.has(day)) {
        return [day, {color: colors.primaryContainer, marked: true, dotColor: colors.onPrimaryContainer}];
      }
      return [day, {marked: true}];
    }),
  );
  return {...highlightedDates, ...trainingDays};
}

/** The selected day and the training days (dots) of a single-date selection. */
function singleMarkedDates(date: Date, workoutDates: string[], colors: Colors): MarkedDates {
  const selectedDay = getYYYYMMDDFormat(date);
  const trainingDays = Object.fromEntries(Array.from(new Set(workoutDates.filter((day) => day !== selectedDay))).map((day) => [day, {marked: true}]));
  return {[selectedDay]: {selectedColor: colors.primary, selected: true}, ...trainingDays};
}

export const DatePickerModal = <T extends DateOrRange>({date, onChange}: DatePickerModalProps<T>) => {
  const {colors} = useTheme();
  const [rangeForWorkouts, setRangeForWorkouts] = useState(() =>
    date instanceof NullableRange
      ? new Range(subtractMonths(4, date.startDate ? getFirstDayOfMonth(date.startDate) : new Date()), getEndOfMonth(date.endDate ? date.endDate : new Date()))
      : new Range(subtractMonths(4, getFirstDayOfMonth(date)), getEndOfMonth(date)),
  );
  const workoutsDone = useWorkoutsIn(rangeForWorkouts);
  const workoutDates = useMemo(() => workoutsDone.map((workout) => getYYYYMMDDFormat(workout.start!!)), [workoutsDone]);

  // GH-673: the dialog re-renders with a new (equal) date object on open and on Save. Keying the
  // markings and the day handler on the date VALUES keeps markedDates, theme and callbacks stable,
  // so the calendar months and their memoized day cells skip those renders.
  const isRange = date instanceof NullableRange;
  const startTime = date instanceof NullableRange ? date.startDate?.getTime() : date.getTime();
  const endTime = date instanceof NullableRange ? date.endDate?.getTime() : undefined;

  const markedDates = useMemo(() => {
    if (!isRange) {
      return singleMarkedDates(new Date(startTime!!), workoutDates, colors);
    }
    return rangeMarkedDates(startTime === undefined ? undefined : new Date(startTime), endTime === undefined ? undefined : new Date(endTime), workoutDates, colors);
  }, [isRange, startTime, endTime, workoutDates, colors]);

  const onDayPress = useCallback(
    (dateData: DateData) => {
      if (!isRange) {
        onChange(new Date(dateData.dateString) as T);
        return;
      }
      if (startTime === undefined && endTime !== undefined) {
        return; // an end without a start is never set by the dialog; the old handler ignored it too
      }
      const pressed = new Date(dateData.dateString);
      if (startTime !== undefined && endTime === undefined && startTime <= pressed.getTime()) {
        onChange(new NullableRange(new Date(startTime), pressed) as T);
      } else {
        // no range yet, a complete range, or a day before the start: start a new range
        onChange(new NullableRange(pressed, undefined) as T);
      }
    },
    [isRange, startTime, endTime, onChange],
  );

  const onVisibleMonthsChange = useCallback(
    (months: DateData[]) =>
      setRangeForWorkouts(new Range(subtractMonths(2, getFirstDayOfMonth(new Date(months[0].timestamp))), subtractMonths(-2, getEndOfMonth(new Date(months[0].timestamp))))),
    [],
  );

  const theme = useMemo(
    () => ({
      backgroundColor: colors.background,
      calendarBackground: colors.background,
      textSectionTitleColor: colors.onBackground,
      selectedDayBackgroundColor: colors.primary,
      selectedDayTextColor: colors.onPrimary,
      todayTextColor: colors.primary,
      dayTextColor: colors.onBackground,
      textDisabledColor: colors.onBackground,
      dotColor: colors.primary,
      selectedDotColor: colors.onPrimary,
      arrowColor: colors.primary,
      monthTextColor: colors.primary,
    }),
    [colors],
  );

  return <CalendarList markingType={'period'} theme={theme} onDayPress={onDayPress} markedDates={markedDates} enableSwipeMonths={true} onVisibleMonthsChange={onVisibleMonthsChange} />;
};

export default DatePickerModal;
