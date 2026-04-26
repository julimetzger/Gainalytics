import {buildRawTrainingData} from '../../app/utils/coachInsight';
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
