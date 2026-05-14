/**
 * GH-256: Verify that the Dashboard week-range computation includes exactly
 * the workouts that fall within the current Mon 00:00:00.000 – Sun 23:59:59.999.
 *
 * We test the full pipeline:
 *   firstDayOfWeek / lastDayOfWeek  →  Range  →  findWorkoutsIn
 *
 * Three workouts are used:
 *   1. Last Monday  (outside — previous week)
 *   2. This Wednesday (inside — current week)
 *   3. Next Monday  (outside — next week)
 *
 * Expected: only workout 2 is returned.
 */

import {firstDayOfWeek, lastDayOfWeek} from '../../../app/utils/DateHelper';
import {Range} from '../../../app/components/picker/date/DateRangePicker';
import {findWorkoutsIn} from '../../../app/redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../../app/models/entities/Workout';
import {NormalizedState} from '../../../app/redux/normalizedState';

// Fix "now" to Wednesday 2024-01-10 at noon (local time, avoids UTC ambiguity).
// Current week: Mon 2024-01-08 … Sun 2024-01-14
const NOW = new Date(2024, 0, 10, 12, 0, 0); // Wednesday

function makeWorkout(id: number, startDate: Date, endDate: Date): Workout {
  return {
    id,
    exerciseId: 1,
    start: startDate,
    end: endDate,
    sets: [],
  } as unknown as Workout;
}

// Last Monday = outside (previous week)
const WORKOUT_LAST_MON = makeWorkout(1,
  new Date(2024, 0, 1, 10, 0, 0),
  new Date(2024, 0, 1, 11, 0, 0),
);
// This Wednesday = inside (current week)
const WORKOUT_THIS_WED = makeWorkout(2,
  new Date(2024, 0, 10, 10, 0, 0),
  new Date(2024, 0, 10, 11, 0, 0),
);
// Next Monday = outside (next week)
const WORKOUT_NEXT_MON = makeWorkout(3,
  new Date(2024, 0, 15, 10, 0, 0),
  new Date(2024, 0, 15, 11, 0, 0),
);

function makeNormalizedState(workouts: Workout[]): NormalizedState<Workout> {
  return {
    byId: Object.fromEntries(workouts.map((w) => [w.id!, w])) as Record<number, Workout>,
    allIds: workouts.map((w) => w.id!),
  };
}

/** Returns YYYY-MM-DD using local date components. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('DashboardTab week-range filtering (GH-256)', () => {
  let currentWeekRange: Range;

  beforeEach(() => {
    // Replicate the exact computation DashboardTab uses on line 22:
    //   new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0))
    currentWeekRange = new Range(firstDayOfWeek(NOW, 1), lastDayOfWeek(NOW, 0));
  });

  it('range starts on Monday 2024-01-08 at 00:00:00.000', () => {
    expect(localDateStr(currentWeekRange.startDate)).toBe('2024-01-08');
    expect(currentWeekRange.startDate.getHours()).toBe(0);
    expect(currentWeekRange.startDate.getMinutes()).toBe(0);
    expect(currentWeekRange.startDate.getSeconds()).toBe(0);
    expect(currentWeekRange.startDate.getMilliseconds()).toBe(0);
  });

  it('range ends on Sunday 2024-01-14 at 23:59:59.999', () => {
    expect(localDateStr(currentWeekRange.endDate)).toBe('2024-01-14');
    expect(currentWeekRange.endDate.getHours()).toBe(23);
    expect(currentWeekRange.endDate.getMinutes()).toBe(59);
    expect(currentWeekRange.endDate.getSeconds()).toBe(59);
    expect(currentWeekRange.endDate.getMilliseconds()).toBe(999);
  });

  it('filters out last-week and next-week workouts — only 1 workout from 3 is in the current week', () => {
    const state = makeNormalizedState([WORKOUT_LAST_MON, WORKOUT_THIS_WED, WORKOUT_NEXT_MON]);
    const result = findWorkoutsIn(state, currentWeekRange);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2); // this Wednesday
  });

  it('includes a workout that starts exactly on Monday boundary (>=)', () => {
    const mondayBoundary = makeWorkout(10,
      new Date(2024, 0, 8, 0, 0, 0, 0),   // Mon 00:00:00.000
      new Date(2024, 0, 8, 1, 0, 0),
    );
    const state = makeNormalizedState([mondayBoundary]);
    const result = findWorkoutsIn(state, currentWeekRange);
    expect(result).toHaveLength(1);
  });

  it('includes a workout that ends exactly on Sunday boundary (<=)', () => {
    const sundayBoundary = makeWorkout(11,
      new Date(2024, 0, 14, 22, 0, 0),
      new Date(2024, 0, 14, 23, 59, 59, 999), // Sun 23:59:59.999
    );
    const state = makeNormalizedState([sundayBoundary]);
    const result = findWorkoutsIn(state, currentWeekRange);
    expect(result).toHaveLength(1);
  });

  it('excludes a workout that starts on the next Monday', () => {
    const afterBoundary = makeWorkout(12,
      new Date(2024, 0, 15, 0, 0, 0),  // Next Monday 00:00:00
      new Date(2024, 0, 15, 1, 0, 0),
    );
    const state = makeNormalizedState([afterBoundary]);
    const result = findWorkoutsIn(state, currentWeekRange);
    expect(result).toHaveLength(0);
  });
});
