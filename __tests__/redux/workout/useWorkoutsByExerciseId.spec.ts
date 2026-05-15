import {useWorkoutsByExerciseId} from '../../../app/redux/Workout/use/useWorkoutsByExerciseId';

let mockState: any;

// Mock useSelector to invoke the selector directly against mockState. We
// ignore the (optional) equality fn and let the underlying createSelector
// handle memoization, mirroring how react-redux will behave at runtime.
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
    expect(result.map((w: any) => w.id)).toEqual([10, 11]);
  });

  it('returns a stable reference on unrelated dispatches that do not clone byId/byExerciseId', () => {
    // Same byId and byExerciseId refs across two store ticks — selector must
    // not allocate a new output array.
    const byId = {
      10: {id: 10, exerciseId: 7, sets: [], start: new Date('2024-01-01')},
    };
    const byExerciseId = {7: [10]};
    mockState = {workouts: {byExerciseId, byId, allIds: [10]}};
    const first = useWorkoutsByExerciseId(7);
    // Simulate an unrelated dispatch: state object changes but workouts slice
    // is the same reference.
    mockState = {workouts: {byExerciseId, byId, allIds: [10]}, somethingElse: {}};
    const second = useWorkoutsByExerciseId(7);
    expect(first).toBe(second);
  });

  it('recomputes ordering after FINALIZE_WORKOUT mutates an entity in place and clones byId', () => {
    // Reproduces the workoutReducer FINALIZE_WORKOUT pattern: `byId[id].end`
    // is mutated in place and ONLY the byId map is cloned. The contained
    // workout objects are the same references in the new state.
    // Before fb5 this combination silently bypassed re-renders because
    // shallowEqual saw identical workout refs and bailed out — leaving
    // History's `end ?? start` ordering stale.
    const w10 = {id: 10, exerciseId: 7, sets: [], start: new Date('2024-01-01'), end: undefined as Date | undefined};
    const w11 = {id: 11, exerciseId: 7, sets: [], start: new Date('2024-02-01'), end: new Date('2024-02-02')};
    const byIdBefore = {10: w10, 11: w11};
    const byExerciseId = {7: [10, 11]};

    mockState = {workouts: {byExerciseId, byId: byIdBefore}};
    const before = useWorkoutsByExerciseId(7);
    expect(before.map((w: any) => w.end?.toISOString() ?? null)).toEqual([null, '2024-02-02T00:00:00.000Z']);

    // FINALIZE_WORKOUT mutation pattern.
    w10.end = new Date('2024-03-01');
    const byIdAfter = {...byIdBefore};
    mockState = {workouts: {byExerciseId, byId: byIdAfter}};
    const after = useWorkoutsByExerciseId(7);

    // The selector must return a DIFFERENT array reference (so useSelector
    // detects the change and consumers re-derive sorted/grouped state).
    expect(after).not.toBe(before);
    expect(after.map((w: any) => w.end?.toISOString())).toEqual(['2024-03-01T00:00:00.000Z', '2024-02-02T00:00:00.000Z']);
  });
});
