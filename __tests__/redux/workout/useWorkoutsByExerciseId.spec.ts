import {useWorkoutsByExerciseId} from '../../../app/redux/Workout/use/useWorkoutsByExerciseId';

let mockState: any;

// Mock useSelector to invoke the selector directly against mockState — the
// equalityFn second arg is intentionally ignored here so each call exercises
// the selector body. This lets us assert reference stability of the returned
// value comes from the selector itself (module-level EMPTY_ARRAY), not from
// react-redux's bail-out.
jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

describe('useWorkoutsByExerciseId', () => {
  it('returns the SAME empty-array reference across calls when exerciseId is undefined', () => {
    mockState = {workouts: {byExerciseId: {}, byId: {}}};
    const first = useWorkoutsByExerciseId(undefined);
    const second = useWorkoutsByExerciseId(undefined);
    expect(first).toBe(second);
    expect(first).toEqual([]);
  });

  it('returns the SAME empty-array reference when exercise has no workouts', () => {
    mockState = {workouts: {byExerciseId: {}, byId: {}}};
    const first = useWorkoutsByExerciseId(7);
    const second = useWorkoutsByExerciseId(7);
    expect(first).toBe(second);
    expect(first).toEqual([]);
  });

  it('returns the SAME empty-array reference when byExerciseId[id] is an empty array', () => {
    mockState = {workouts: {byExerciseId: {7: []}, byId: {}}};
    const first = useWorkoutsByExerciseId(7);
    const second = useWorkoutsByExerciseId(7);
    expect(first).toBe(second);
    expect(first).toEqual([]);
  });

  it('returns the SAME empty reference for the undefined and the empty-id branches', () => {
    mockState = {workouts: {byExerciseId: {7: []}, byId: {}}};
    // Both empty paths must collapse to the same module-level constant so any
    // caller switching between them does not see a reference change.
    expect(useWorkoutsByExerciseId(undefined)).toBe(useWorkoutsByExerciseId(7));
  });

  it('returns the workouts mapped from byId for an exercise with workouts', () => {
    mockState = {
      workouts: {
        byExerciseId: {7: [10, 11]},
        byId: {
          10: {id: 10, exerciseId: 7, sets: [], start: new Date('2024-01-01')},
          11: {id: 11, exerciseId: 7, sets: [], start: new Date('2024-02-01')},
        },
      },
    };
    const result = useWorkoutsByExerciseId(7);
    expect(result.map((w) => w.id)).toEqual([10, 11]);
  });
});
