import {Range} from '../../app/components/picker/date/DateRangePicker';
import {describeRange, isRangeMissingLastWorkout, rangeEndingAt, rangeEndingToday} from '../../app/utils/analyse-range';
import {findLastWorkoutDate} from '../../app/redux/Workout/use/useLastWorkoutDate';
import {Workout} from '../../app/models/entities/Workout';
import {NormalizedState} from '../../app/redux/normalizedState';

/**
 * GH-458 (H5): the baseline data ends on 28/02/2026 while the app runs months
 * later, so every screen's default range is empty. These helpers are what lets
 * a screen say so and offer a one-tap correction.
 */

const LAST_WORKOUT = new Date(2026, 1, 28, 19, 30); // 28 Feb 2026
const TODAY = new Date(2026, 8, 20, 12, 0); // 20 Sep 2026

const makeWorkout = (id: number, start: Date, end: Date) => ({id, exerciseId: 1, start, end, sets: [{}]} as unknown as Workout);

const makeState = (workouts: Workout[], extraById: Record<string, unknown> = {}, extraIds: unknown[] = []): NormalizedState<Workout> =>
  ({
    byId: {...Object.fromEntries(workouts.map((workout) => [workout.id!, workout])), ...extraById},
    allIds: [...workouts.map((workout) => workout.id!), ...extraIds],
  } as unknown as NormalizedState<Workout>);

describe('findLastWorkoutDate (GH-458 H5)', () => {
  it('returns the newest workout end date', () => {
    const state = makeState([
      makeWorkout(1, new Date(2025, 10, 2, 10, 0), new Date(2025, 10, 2, 11, 0)),
      makeWorkout(2, LAST_WORKOUT, LAST_WORKOUT),
      makeWorkout(3, new Date(2026, 0, 12, 10, 0), new Date(2026, 0, 12, 11, 0)),
    ]);

    expect(findLastWorkoutDate(state)).toEqual(LAST_WORKOUT);
  });

  it('returns undefined for a genuinely empty store', () => {
    expect(findLastWorkoutDate(makeState([]))).toBeUndefined();
  });

  /**
   * The exported .gains fixtures carry a literal "undefined" key in byId. A
   * plain Math.max over the ids yields NaN and the banner would never appear.
   */
  it('skips ids that do not resolve to a dated workout', () => {
    const state = makeState([makeWorkout(1, LAST_WORKOUT, LAST_WORKOUT)], {undefined: undefined}, ['undefined']);

    expect(findLastWorkoutDate(state)).toEqual(LAST_WORKOUT);
  });

  it('falls back to the start date when a workout has no end', () => {
    const state = makeState([{id: 1, exerciseId: 1, start: LAST_WORKOUT, sets: [{}]} as unknown as Workout]);

    expect(findLastWorkoutDate(state)).toEqual(LAST_WORKOUT);
  });
});

describe('analyse range helpers (GH-458 H5)', () => {
  it('rangeEndingAt covers the three months up to and including the last workout day', () => {
    const range = rangeEndingAt(LAST_WORKOUT, 3);

    expect(range.endDate.getFullYear()).toBe(2026);
    expect(range.endDate.getMonth()).toBe(1);
    expect(range.endDate.getDate()).toBe(28);
    expect(range.endDate.getHours()).toBe(23);
    expect(range.startDate.getMonth()).toBe(10); // Nov 2025
    expect(range.startDate.getFullYear()).toBe(2025);
    expect(range.dateIsInRange(LAST_WORKOUT)).toBe(true);
  });

  it('rangeEndingToday covers the last twelve months', () => {
    const range = rangeEndingToday(12, TODAY);

    expect(range.endDate.getDate()).toBe(20);
    expect(range.endDate.getMonth()).toBe(8);
    expect(range.startDate.getFullYear()).toBe(2025);
    expect(range.startDate.getMonth()).toBe(8);
  });

  describe('isRangeMissingLastWorkout', () => {
    it('is true for the returning user whose default range starts after the last training', () => {
      const defaultRange = new Range(new Date(2026, 5, 14), new Date(2026, 8, 20));

      expect(isRangeMissingLastWorkout(defaultRange, LAST_WORKOUT)).toBe(true);
    });

    it('is false when the last training falls inside the range', () => {
      const populatedRange = new Range(new Date(2025, 11, 1), new Date(2026, 1, 28, 23, 59));

      expect(isRangeMissingLastWorkout(populatedRange, LAST_WORKOUT)).toBe(false);
    });

    it('is false on an empty account, where there is nothing to point at', () => {
      const defaultRange = new Range(new Date(2026, 5, 14), new Date(2026, 8, 20));

      expect(isRangeMissingLastWorkout(defaultRange, undefined)).toBe(false);
    });
  });

  it('describeRange uses the same wording as the range button', () => {
    const range = new Range(new Date(2025, 11, 1), new Date(2026, 1, 28));

    // The audit found six different date formats in the Analyse area. Reusing
    // the range button's exact rendering keeps an empty state's "between …"
    // readable against the control the user would change.
    expect(describeRange(range)).toBe('Mon, 01/12/25 to Sat, 28/02/26');
  });
});
