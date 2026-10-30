import {buildRawTrainingData, buildSingleSessionData} from '../../app/utils/coachInsight';
import {Training} from '../../app/models/entities/Training';
import {Workout} from '../../app/models/entities/Workout';
import {Exercise} from '../../app/models/entities/Exercise';
import {VideoAnalysis, VideoAnalysisStatus} from '../../app/models/entities/VideoAnalysis';
import {TrainingsState} from '../../app/models/TrainingsState';

function makeTraining(id: number, workoutId: number): Training {
  return {
    id,
    doneWorkoutIds: {10: workoutId},
    plannedWorkouts: {},
    exercises: [10],
    state: TrainingsState.FINISHED,
    end: new Date('2026-04-01'),
  } as Training;
}

function makeExercise(id: number, name: string): Exercise {
  return {id, name, muscles: []} as unknown as Exercise;
}

describe('buildRawTrainingData – VL lookup (GH-175 regression)', () => {
  it('assigns vl_percent to correct set when set indices are 1-based', () => {
    // Simulates the real case: first set has index=1, second set has index=2.
    // Video is linked to setIndex=1, so vl_percent must appear on array position 0, not 1.
    const workout: Workout = {
      id: 100,
      sets: [
        {index: 1, reps: 5, weight: 100, rir: 2, date: new Date()},
        {index: 2, reps: 5, weight: 90,  rir: 2, date: new Date()},
      ],
      exerciseId: 10,
      trainingsId: 1,
    } as unknown as Workout;

    const videoAnalysis: VideoAnalysis = {
      id: 200,
      workoutId: 100,
      exerciseId: 10,
      setIndex: 1,
      status: VideoAnalysisStatus.DONE,
      setResult: {velocityLossPercent: 22.5} as any,
      sourceUri: '',
      createdAt: new Date(),
      videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
    };

    const result = buildRawTrainingData(
      [makeTraining(1, 100)],
      1,
      {100: workout},
      {10: makeExercise(10, 'Bench Press')},
      {200: videoAnalysis},
    );

    const sets = result.sessions[0].exercises[0].sets;
    expect(sets[0].vl_percent).toBe(23);        // Math.round(22.5) → Set index 1 (array pos 0)
    expect(sets[1].vl_percent).toBeUndefined();  // Set index 2 has no analysis
  });

  it('does not assign vl_percent to any set when no analyses exist', () => {
    const workout: Workout = {
      id: 100,
      sets: [{index: 1, reps: 5, weight: 100, rir: 2, date: new Date()}],
      exerciseId: 10,
      trainingsId: 1,
    } as unknown as Workout;

    const result = buildRawTrainingData(
      [makeTraining(1, 100)],
      1,
      {100: workout},
      {10: makeExercise(10, 'Squat')},
      {},
    );

    expect(result.sessions[0].exercises[0].sets[0].vl_percent).toBeUndefined();
  });
});

describe('buildSingleSessionData (GH-645)', () => {
  const workout = (id: number, weight: number) =>
    ({id, exerciseId: 10, sets: [{index: 1, reps: 5, weight, rir: 2, date: new Date()}]}) as unknown as Workout;
  const training = (id: number, plannedId: number | undefined, doneId: number | undefined, end: string): Training =>
    ({
      id,
      plannedWorkouts: plannedId ? {10: plannedId} : {},
      doneWorkoutIds: doneId ? {10: doneId} : {},
      exercises: [10],
      state: TrainingsState.FINISHED,
      end: new Date(end),
    }) as Training;
  const exercises = {10: makeExercise(10, 'Squat')};

  it('holds the plan, the done sets with VL% and the done sets of the comparison training', () => {
    const vl: VideoAnalysis = {
      id: 1,
      workoutId: 101,
      exerciseId: 10,
      setIndex: 1,
      status: VideoAnalysisStatus.DONE,
      setResult: {velocityLossPercent: 31.4} as any,
      sourceUri: '',
      createdAt: new Date(),
      videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
    };
    const result = buildSingleSessionData(
      training(2, 100, 101, '2026-04-08T10:00:00Z'),
      'Micro 2 · Legs',
      {training: training(1, undefined, 200, '2026-04-01T10:00:00Z'), name: 'Micro 1 · Legs'},
      {100: workout(100, 140), 101: workout(101, 142.5), 200: workout(200, 137.5)},
      exercises,
      {1: vl},
    );

    expect(result).toEqual({
      name: 'Micro 2 · Legs',
      date: '2026-04-08',
      finished: true,
      plan: [{name: 'Squat', primary_muscles: [], sets: [{reps: 5, weight_kg: 140, rir: 2}]}],
      done: [{name: 'Squat', primary_muscles: [], sets: [{reps: 5, weight_kg: 142.5, rir: 2, vl_percent: 31}]}],
      previous: {name: 'Micro 1 · Legs', date: '2026-04-01', done: [{name: 'Squat', primary_muscles: [], sets: [{reps: 5, weight_kg: 137.5, rir: 2}]}]},
    });
  });

  it('is undefined while nothing was logged in the training', () => {
    expect(buildSingleSessionData(training(2, 100, undefined, '2026-04-08'), 'Micro 2 · Legs', undefined, {100: workout(100, 140)}, exercises, {})).toBeUndefined();
  });
});
