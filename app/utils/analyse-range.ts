import {Range} from '../components/picker/date/DateRangePicker';
import {getEndOfDay, getDateStringFromDate, subtractMonths} from './DateHelper';

/**
 * GH-458 (H3/H4/H5): shared date-range helpers for the Analyse area.
 *
 * Every Analyse screen starts on its own default range, all of which are empty
 * for a user who paused. These helpers build the range that a one-tap
 * correction should jump to, and describe a range in the user's own words so an
 * empty state can name the cause instead of showing a blank box.
 */

export const ANALYSE_CATCH_UP_RANGE_MONTHS = 3;
export const ANALYSE_EXTENDED_RANGE_MONTHS = 12;

/** A range of `months` that ends on the day of `lastWorkoutDate` (inclusive). */
export const rangeEndingAt = (lastWorkoutDate: Date, months: number = ANALYSE_CATCH_UP_RANGE_MONTHS): Range => {
  const end = getEndOfDay(new Date(lastWorkoutDate));
  return new Range(subtractMonths(months, new Date(end)), end);
};

/** A range of `months` that ends today (inclusive). */
export const rangeEndingToday = (months: number = ANALYSE_EXTENDED_RANGE_MONTHS, today: Date = new Date()): Range => {
  const end = getEndOfDay(new Date(today));
  return new Range(subtractMonths(months, new Date(end)), end);
};

/** `true` when the newest known workout lies outside the given range. */
export const isRangeMissingLastWorkout = (range: Range, lastWorkoutDate: Date | undefined): boolean => {
  if (lastWorkoutDate === undefined) {
    return false;
  }

  return new Date(lastWorkoutDate).getTime() > range.endDate.getTime() || new Date(lastWorkoutDate).getTime() < range.startDate.getTime();
};

/** "14/06/26 to 20/09/26" — the same wording the range button uses. */
export const describeRange = (range: Range) => `${getDateStringFromDate(range.startDate)} to ${getDateStringFromDate(range.endDate)}`;
