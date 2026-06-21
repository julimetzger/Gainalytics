import {
  sortExerciseIdsByPlan,
  sortExerciseIdsByDate,
} from '../../../../app/components/Training/analyse/MicroExerciseOverview';

describe('sortExerciseIdsByPlan', () => {
  it('returns exercise IDs in the order defined by training.exercises', () => {
    const trainingExercises = [3, 1, 2];
    const doneWorkoutIds: {[key: number]: number} = {1: 10, 2: 20, 3: 30};
    expect(sortExerciseIdsByPlan(trainingExercises, doneWorkoutIds)).toEqual([3, 1, 2]);
  });

  it('filters out exercises that were not logged', () => {
    const trainingExercises = [1, 2, 3];
    const doneWorkoutIds: {[key: number]: number} = {1: 10, 3: 30};
    expect(sortExerciseIdsByPlan(trainingExercises, doneWorkoutIds)).toEqual([1, 3]);
  });

  it('returns an empty array when no exercises were logged', () => {
    const trainingExercises = [1, 2, 3];
    const doneWorkoutIds: {[key: number]: number} = {};
    expect(sortExerciseIdsByPlan(trainingExercises, doneWorkoutIds)).toEqual([]);
  });

  it('returns an empty array when training has no planned exercises', () => {
    const trainingExercises: number[] = [];
    const doneWorkoutIds: {[key: number]: number} = {1: 10};
    expect(sortExerciseIdsByPlan(trainingExercises, doneWorkoutIds)).toEqual([]);
  });
});

describe('sortExerciseIdsByDate', () => {
  it('sorts exercise IDs by workout start time ascending', () => {
    const workouts = [
      {exerciseId: 2, start: new Date('2024-01-01T10:00:00Z')},
      {exerciseId: 1, start: new Date('2024-01-01T08:00:00Z')},
      {exerciseId: 3, start: new Date('2024-01-01T12:00:00Z')},
    ];
    expect(sortExerciseIdsByDate(workouts)).toEqual([1, 2, 3]);
  });

  it('places workouts without a start date before those with one', () => {
    const workouts = [
      {exerciseId: 2, start: new Date('2024-01-01T10:00:00Z')},
      {exerciseId: 1, start: undefined},
    ];
    expect(sortExerciseIdsByDate(workouts)).toEqual([1, 2]);
  });

  it('does not mutate the input array', () => {
    const workouts = [
      {exerciseId: 2, start: new Date('2024-01-01T10:00:00Z')},
      {exerciseId: 1, start: new Date('2024-01-01T08:00:00Z')},
    ];
    const original = [...workouts];
    sortExerciseIdsByDate(workouts);
    expect(workouts).toEqual(original);
  });

  it('returns an empty array for empty input', () => {
    expect(sortExerciseIdsByDate([])).toEqual([]);
  });
});
