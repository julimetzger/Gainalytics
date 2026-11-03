import {renderHook} from '@testing-library/react-native';
import {useWorkoutsIn} from '../../../../app/redux/Workout/use/useWorkoutsIn';
import {Range} from '../../../../app/components/picker/date/DateRangePicker';
import {Workout} from '../../../../app/models/entities/Workout';

let mockState: {workouts: {byId: Record<number, Workout>; allIds: number[]}};

// The selector result itself (no equality function): shows whether the hook scanned the workouts again.
jest.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector(mockState),
}));

const makeWorkout = (id: number, start: Date) => ({id, exerciseId: 1, start, end: start, sets: []}) satisfies Partial<Workout>;

const week = (day: number) => new Range(new Date(2026, 1, day), new Date(2026, 1, day + 6, 23, 59, 59));

// GH-675: Dashboard and Metrics build a new Range on every render. The hook caches per instance on the range's
// values, so re-rendering with an equal range does not scan all workouts again.
describe('useWorkoutsIn (GH-675)', () => {
  beforeEach(() => {
    const workouts = [makeWorkout(1, new Date(2026, 1, 3)), makeWorkout(2, new Date(2026, 1, 10)), makeWorkout(3, new Date(2026, 1, 17))];
    mockState = {
      workouts: {
        byId: Object.fromEntries(workouts.map((workout) => [workout.id, workout])) as Record<number, Workout>,
        allIds: workouts.map((workout) => workout.id),
      },
    };
  });

  it('returns the workouts of the range', () => {
    const {result} = renderHook(() => useWorkoutsIn(week(9)));

    expect(result.current).toEqual([makeWorkout(2, new Date(2026, 1, 10))]);
  });

  it('returns the same array when re-rendered with a NEW range object of the same period', () => {
    const {result, rerender} = renderHook(({day}: {day: number}) => useWorkoutsIn(week(day)), {initialProps: {day: 9}});
    const first = result.current;

    rerender({day: 9});

    expect(result.current).toBe(first);
  });

  it('keeps one cache per hook instance — two ranges in one component do not evict each other', () => {
    const {result, rerender} = renderHook(() => ({current: useWorkoutsIn(week(9)), previous: useWorkoutsIn(week(2))}));
    const first = result.current;

    rerender({});

    expect(result.current.current).toBe(first.current);
    expect(result.current.previous).toBe(first.previous);
    expect(first).toEqual({current: [makeWorkout(2, new Date(2026, 1, 10))], previous: [makeWorkout(1, new Date(2026, 1, 3))]});
  });

  it('recomputes when the period or the workouts change', () => {
    const {result, rerender} = renderHook(({day}: {day: number}) => useWorkoutsIn(week(day)), {initialProps: {day: 9}});

    rerender({day: 16});
    expect(result.current).toEqual([makeWorkout(3, new Date(2026, 1, 17))]);

    const added = makeWorkout(4, new Date(2026, 1, 18));
    mockState = {workouts: {byId: {...mockState.workouts.byId, 4: added}, allIds: [...mockState.workouts.allIds, 4]}};
    rerender({day: 16});
    expect(result.current).toEqual([makeWorkout(3, new Date(2026, 1, 17)), added]);
  });
});
