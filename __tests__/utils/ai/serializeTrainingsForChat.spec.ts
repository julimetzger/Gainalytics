import {serializeTrainingsForChat} from '../../../app/utils/ai/serializeTrainingsForChat';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {Exercise} from '../../../app/models/entities/Exercise';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {TrainingsState} from '../../../app/models/TrainingsState';

function makeTraining(overrides: Partial<Training> = {}): Training {
  return {
    id: 1,
    doneWorkoutIds: {10: 100},
    plannedWorkouts: {},
    exercises: [10],
    state: TrainingsState.FINISHED,
    end: new Date('2026-04-01'),
    ...overrides,
  };
}

function makeWorkout(id: number, sets = [{reps: 5, weight: 100, rir: 2}]): Workout {
  return {
    id,
    sets: sets.map((s, idx) => ({...s, index: idx, date: new Date()})),
    exerciseId: 10,
    trainingsId: 1,
  } as unknown as Workout;
}

function makeExercise(id: number, name: string): Exercise {
  return {id, name, muscles: []};
}

const emptyVideoAnalyses: Record<number, VideoAnalysis> = {};

describe('serializeTrainingsForChat', () => {
  it('returns null for empty trainings array', () => {
    const result = serializeTrainingsForChat([], {}, {}, emptyVideoAnalyses);
    expect(result).toBeNull();
  });

  it('returns null when all trainings are not FINISHED', () => {
    const t = makeTraining({state: TrainingsState.PLANNED});
    const result = serializeTrainingsForChat([t], {}, {}, emptyVideoAnalyses);
    expect(result).toBeNull();
  });

  it('serialises a single finished training with exercise name and sets', () => {
    const t = makeTraining();
    const workoutsById = {100: makeWorkout(100)};
    const exercisesById = {10: makeExercise(10, 'Squat')};

    const json = serializeTrainingsForChat([t], workoutsById, exercisesById, emptyVideoAnalyses);
    expect(json).not.toBeNull();
    const ctx = JSON.parse(json!);
    expect(ctx.sessions).toHaveLength(1);
    expect(ctx.sessions[0].exercises[0].name).toBe('Squat');
    expect(ctx.sessions[0].exercises[0].sets[0]).toEqual({reps: 5, weight_kg: 100, rir: 2});
  });

  it('strips internal fields: no id, no localUpdatedAt, no records', () => {
    const t = makeTraining();
    const workoutsById = {100: makeWorkout(100)};
    const exercisesById = {10: makeExercise(10, 'Bench Press')};

    const json = serializeTrainingsForChat([t], workoutsById, exercisesById, emptyVideoAnalyses);
    const ctx = JSON.parse(json!);
    const session = ctx.sessions[0];
    // No Training-level id should be in the output
    expect(session.id).toBeUndefined();
    expect(session.exercises[0].id).toBeUndefined();
    const set = session.exercises[0].sets[0];
    expect(set.record).toBeUndefined();
    expect(set.date).toBeUndefined();
    expect(set.index).toBeUndefined();
  });

  it('includes analysis fields: date, exercise name, sets with reps/weight/rir', () => {
    const t = makeTraining({end: new Date('2026-03-15')});
    const workoutsById = {100: makeWorkout(100, [{reps: 3, weight: 150, rir: 1}])};
    const exercisesById = {10: makeExercise(10, 'Deadlift')};

    const json = serializeTrainingsForChat([t], workoutsById, exercisesById, emptyVideoAnalyses);
    const ctx = JSON.parse(json!);
    expect(ctx.sessions[0].date).toBe('2026-03-15');
    expect(ctx.sessions[0].exercises[0].name).toBe('Deadlift');
    expect(ctx.sessions[0].exercises[0].sets[0]).toEqual({reps: 3, weight_kg: 150, rir: 1});
  });

  it('passes through meso_name and micro_label', () => {
    const t = makeTraining();
    const workoutsById = {100: makeWorkout(100)};
    const exercisesById = {10: makeExercise(10, 'Squat')};

    const json = serializeTrainingsForChat(
      [t], workoutsById, exercisesById, emptyVideoAnalyses,
      'Hypertrophy Block', 'M3',
    );
    const ctx = JSON.parse(json!);
    expect(ctx.meso_name).toBe('Hypertrophy Block');
    expect(ctx.micro_label).toBe('M3');
  });

  it('omits meso_name and micro_label when not provided', () => {
    const t = makeTraining();
    const json = serializeTrainingsForChat([t], {100: makeWorkout(100)}, {10: makeExercise(10, 'Squat')}, emptyVideoAnalyses);
    const ctx = JSON.parse(json!);
    expect(ctx.meso_name).toBeUndefined();
    expect(ctx.micro_label).toBeUndefined();
  });

  it('includes vl_percent when a DONE video analysis exists for the set', () => {
    const t = makeTraining();
    const workoutsById = {100: makeWorkout(100)};
    const exercisesById = {10: makeExercise(10, 'Squat')};
    const videoAnalysesById: Record<number, VideoAnalysis> = {
      200: {
        id: 200,
        workoutId: 100,
        setIndex: 0,
        status: VideoAnalysisStatus.DONE,
        setResult: {velocityLossPercent: 18.7} as any,
        sourceUri: '',
        createdAt: new Date(),
        videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
      },
    };

    const json = serializeTrainingsForChat([t], workoutsById, exercisesById, videoAnalysesById);
    const ctx = JSON.parse(json!);
    expect(ctx.sessions[0].exercises[0].sets[0].vl_percent).toBe(19); // Math.round(18.7)
  });

  it('assigns vl_percent to correct set when set indices are 1-based (regression GH-175)', () => {
    // Real sets have index starting at 1, not 0. Video linked to set index 1 must appear on
    // the first set (array position 0), not on the second set (array position 1).
    const t = makeTraining();
    const workout = {
      id: 100,
      sets: [
        {index: 1, reps: 5, weight: 100, rir: 2, date: new Date()},
        {index: 2, reps: 5, weight: 90,  rir: 2, date: new Date()},
      ],
      exerciseId: 10,
      trainingsId: 1,
    } as unknown as any;
    const workoutsById = {100: workout};
    const exercisesById = {10: makeExercise(10, 'Squat')};
    const videoAnalysesById: Record<number, VideoAnalysis> = {
      200: {
        id: 200,
        workoutId: 100,
        setIndex: 1,
        status: VideoAnalysisStatus.DONE,
        setResult: {velocityLossPercent: 20.0} as any,
        sourceUri: '',
        createdAt: new Date(),
        videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
      },
    };

    const json = serializeTrainingsForChat([t], workoutsById, exercisesById, videoAnalysesById);
    const ctx = JSON.parse(json!);
    const sets = ctx.sessions[0].exercises[0].sets;
    expect(sets[0].vl_percent).toBe(20);   // Set index 1 → array position 0
    expect(sets[1].vl_percent).toBeUndefined(); // Set index 2 → no analysis
  });

  it('does not hardcode 28-day filter — serialises all passed trainings', () => {
    const old = makeTraining({id: 1, end: new Date('2025-01-01'), doneWorkoutIds: {10: 100}});
    const recent = makeTraining({id: 2, end: new Date('2026-04-01'), doneWorkoutIds: {10: 101}});
    const workoutsById = {100: makeWorkout(100), 101: makeWorkout(101)};
    const exercisesById = {10: makeExercise(10, 'Squat')};

    const json = serializeTrainingsForChat([old, recent], workoutsById, exercisesById, emptyVideoAnalyses);
    const ctx = JSON.parse(json!);
    expect(ctx.sessions).toHaveLength(2);
    expect(ctx.sessions[0].date).toBe('2025-01-01');
    expect(ctx.sessions[1].date).toBe('2026-04-01');
  });
});
