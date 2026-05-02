import {useLastFinishedWorkout} from '../../../app/redux/Workout/use/useLastFinishedWorkout';

let mockState: any;

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

describe('useLastFinishedWorkout', () => {
  const exercise = {id: 7, name: 'Squat'} as any;

  it('returns undefined when the exercise has no workouts', () => {
    mockState = {workouts: {byExerciseId: {}, byId: {}}};
    expect(useLastFinishedWorkout(exercise)).toBeUndefined();
  });

  it('skips an in-progress workout (no end) and returns the previous finished one', () => {
    mockState = {
      workouts: {
        byExerciseId: {7: [10, 11]},
        byId: {
          10: {id: 10, exerciseId: 7, end: new Date('2024-01-01'), sets: [{reps: 5, rir: 1, weight: 100}]},
          11: {id: 11, exerciseId: 7, end: undefined, sets: [{reps: 5, rir: 1, weight: 110}]},
        },
      },
    };
    const result = useLastFinishedWorkout(exercise);
    expect(result?.id).toBe(10);
  });

  it('returns the most recent finished workout when multiple finished exist', () => {
    mockState = {
      workouts: {
        byExerciseId: {7: [10, 11, 12]},
        byId: {
          10: {id: 10, exerciseId: 7, end: new Date('2024-01-01'), sets: []},
          11: {id: 11, exerciseId: 7, end: new Date('2024-02-01'), sets: []},
          12: {id: 12, exerciseId: 7, end: new Date('2024-03-01'), sets: []},
        },
      },
    };
    expect(useLastFinishedWorkout(exercise)?.id).toBe(12);
  });

  it('returns undefined when only an in-progress workout exists', () => {
    mockState = {
      workouts: {
        byExerciseId: {7: [11]},
        byId: {
          11: {id: 11, exerciseId: 7, end: undefined, sets: []},
        },
      },
    };
    expect(useLastFinishedWorkout(exercise)).toBeUndefined();
  });
});
