import {useWorkoutsByFilters} from '../../../../app/redux/Workout/use/useWorkoutsByFilters';
import {Muscles} from '../../../../app/models/Muscles';

let mockState: any;

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

const makeWorkout = (id: number, exerciseId: number, start = new Date('2024-01-01'), end?: Date) => ({
  id,
  exerciseId,
  sets: [],
  start,
  end,
});

const makeExercise = (id: number, muscles: Muscles[]) => ({
  id,
  name: `Exercise ${id}`,
  muscles: muscles.map((muscle) => ({muscle, percent: 100})),
});

describe('useWorkoutsByFilters', () => {
  // Bench Press (id:1) → Chest, Triceps, Shoulders
  // Squat (id:2) → Quads, Glutes, Hamstrings, Core, Back
  // Deadlift (id:3) → Back, Glutes, Hamstrings

  const exercises = {
    1: makeExercise(1, [Muscles.CHEST, Muscles.TRICEPS, Muscles.SHOULDERS]),
    2: makeExercise(2, [Muscles.QUADS, Muscles.GLUTES, Muscles.HAMSTRINGS, Muscles.CORE, Muscles.BACK]),
    3: makeExercise(3, [Muscles.BACK, Muscles.GLUTES, Muscles.HAMSTRINGS]),
  };

  // Workouts: w10→bench, w11→squat, w12→deadlift, w13→bench (newest)
  const workouts = {
    10: makeWorkout(10, 1, new Date('2024-01-10')),
    11: makeWorkout(11, 2, new Date('2024-01-11')),
    12: makeWorkout(12, 3, new Date('2024-01-12')),
    13: makeWorkout(13, 1, new Date('2024-01-13')),
  };

  beforeEach(() => {
    mockState = {
      workouts: {allIds: [10, 11, 12, 13], byId: workouts},
      exercises: {byId: exercises, allIds: [1, 2, 3]},
    };
  });

  it('no-filter: returns all started workout ids sorted newest-first', () => {
    const result = useWorkoutsByFilters([], []);
    expect(result).toEqual([13, 12, 11, 10]);
  });

  it('exercise filter: returns only workouts for the selected exercise', () => {
    const result = useWorkoutsByFilters([], [1]);
    // workouts 10 and 13 belong to exercise 1 (bench), newest first
    expect(result).toEqual([13, 10]);
  });

  it('muscle filter: returns workouts whose exercise targets the selected muscle', () => {
    // Chest → exercise 1 (bench) → workouts 10, 13
    const result = useWorkoutsByFilters([Muscles.CHEST], []);
    expect(result).toEqual([13, 10]);
  });

  it('OR semantics: muscle + exercise union — no duplicate ids', () => {
    // Back muscle → exercises 2 (squat) and 3 (deadlift) → workouts 11, 12
    // Exercise 1 (bench) → workouts 10, 13
    // Union: 10, 11, 12, 13, sorted newest-first
    const result = useWorkoutsByFilters([Muscles.BACK], [1]);
    expect(result).toEqual([13, 12, 11, 10]);
  });

  it('combined filters: muscle + exercise where muscle has no overlap — OR, no duplicates', () => {
    // Chest → bench (1) → workouts 10, 13
    // Exercise 2 (squat) → workout 11
    // Union: 10, 11, 13 sorted newest-first
    const result = useWorkoutsByFilters([Muscles.CHEST], [2]);
    expect(result).toEqual([13, 11, 10]);
  });

  it('returns EMPTY_IDS stable ref when no workouts match', () => {
    // Biceps muscle — none of the test exercises have Biceps
    const first = useWorkoutsByFilters([Muscles.BICEPS], []);
    const second = useWorkoutsByFilters([Muscles.BICEPS], []);
    expect(first).toBe(second);
    expect(first).toEqual([]);
  });

  it('excludes workouts with no start date', () => {
    mockState = {
      workouts: {
        allIds: [10, 20],
        byId: {
          10: makeWorkout(10, 1, new Date('2024-01-10')),
          20: {id: 20, exerciseId: 1, sets: []}, // no start
        },
      },
      exercises: {byId: exercises, allIds: [1, 2, 3]},
    };
    const result = useWorkoutsByFilters([], []);
    expect(result).toEqual([10]);
  });

  it('sorts by end date when available (newest end wins)', () => {
    mockState = {
      workouts: {
        allIds: [10, 11],
        byId: {
          10: makeWorkout(10, 1, new Date('2024-01-10'), new Date('2024-01-20')),
          11: makeWorkout(11, 2, new Date('2024-01-11'), new Date('2024-01-15')),
        },
      },
      exercises: {byId: exercises, allIds: [1, 2, 3]},
    };
    // workout 10 ends 2024-01-20 > workout 11 ends 2024-01-15
    const result = useWorkoutsByFilters([], []);
    expect(result).toEqual([10, 11]);
  });

  it('returns stable ref on unrelated state change when inputs are identical refs', () => {
    const muscles: Muscles[] = [];
    const exerciseIds: number[] = [];
    const allIds = [10, 11, 12, 13];
    const byId = workouts;
    const exercisesById = exercises;

    mockState = {workouts: {allIds, byId}, exercises: {byId: exercisesById, allIds: [1, 2, 3]}};
    const first = useWorkoutsByFilters(muscles, exerciseIds);

    // Simulate unrelated dispatch: state object changes but slices are same refs
    mockState = {workouts: {allIds, byId}, exercises: {byId: exercisesById, allIds: [1, 2, 3]}, somethingElse: {}};
    const second = useWorkoutsByFilters(muscles, exerciseIds);

    expect(first).toBe(second);
  });
});
