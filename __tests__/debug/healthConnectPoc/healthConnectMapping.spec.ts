import {
  describeSets,
  mapTrainingToHealthConnectSession,
  segmentTypeForExercise,
} from '../../../app/debug/healthConnectPoc/healthConnectMapping';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';

const START = Date.UTC(2026, 9, 10, 17, 0);
const END = Date.UTC(2026, 9, 10, 18, 30);

const exercisesById = {
  1: {id: 1, name: 'Low bar squat'},
  2: {id: 2, name: 'Bench press competition'},
  3: {id: 3, name: 'Barbell row'},
};

const workoutsById: {[id: number]: Workout} = {
  10: {
    id: 10,
    exerciseId: 1,
    sets: [
      {reps: 5, weight: 140, rir: 2},
      {reps: 5, weight: 140, rir: 2},
      {reps: 3, weight: 150, rir: 1},
    ],
  } as Workout,
  20: {
    id: 20,
    exerciseId: 2,
    // Persisted dates are ISO strings after rehydration.
    start: new Date(START + 40 * 60000).toISOString() as any,
    end: new Date(START + 70 * 60000).toISOString() as any,
    sets: [
      {reps: 8, weight: 90, rir: 2},
      {reps: 0, weight: 90, rir: 0},
    ],
  } as Workout,
  30: {id: 30, exerciseId: 3, sets: []} as unknown as Workout,
};

const training = (overrides: Partial<Training> = {}): Training => ({
  id: 7,
  state: TrainingsState.FINISHED,
  start: new Date(START).toISOString() as any,
  end: new Date(END).toISOString() as any,
  exercises: [1, 2, 3],
  doneWorkoutIds: {1: 10, 2: 20, 3: 30},
  plannedWorkouts: {},
  ...overrides,
});

describe('GH-502 Health Connect mapping', () => {
  it('maps exercise names to Health Connect segment types, specific patterns first', () => {
    expect(segmentTypeForExercise('Low bar squat')).toBe('SQUAT');
    expect(segmentTypeForExercise('Bulgarian split squat')).toBe('LUNGE');
    expect(segmentTypeForExercise('Leg press')).toBe('LEG_PRESS');
    expect(segmentTypeForExercise('Leg curl')).toBe('LEG_CURL');
    expect(segmentTypeForExercise('Hammer curl')).toBe('ARM_CURL');
    expect(segmentTypeForExercise('Romanian deadlift')).toBe('DEADLIFT');
    expect(segmentTypeForExercise('Close grip bench')).toBe('BENCH_PRESS');
    expect(segmentTypeForExercise('Overhead press')).toBe('BARBELL_SHOULDER_PRESS');
    // No Health Connect type for barbell rows: falls back to the generic weightlifting segment.
    expect(segmentTypeForExercise('Barbell row')).toBe('WEIGHTLIFTING');
    expect(segmentTypeForExercise(undefined)).toBe('WEIGHTLIFTING');
  });

  it('groups identical consecutive sets in the notes text', () => {
    expect(describeSets(workoutsById[10].sets)).toBe('2 × (5 × 140 kg @ RIR 2), 3 × 150 kg @ RIR 1');
  });

  it('writes one segment per executed exercise with summed reps inside the session', () => {
    const session = mapTrainingToHealthConnectSession(training(), workoutsById, exercisesById, 1234)!;

    expect(session.clientRecordId).toBe('gainalytics-training-7');
    expect(session.clientRecordVersion).toBe(1234);
    expect(session.startMs).toBe(START);
    expect(session.endMs).toBe(END);
    expect(session.title).toBe('Gainalytics: Low bar squat, Bench press competition');
    expect(session.segments.map(s => [s.segmentType, s.repetitions])).toEqual([
      ['SQUAT', 13],
      ['BENCH_PRESS', 8],
    ]);
    // Squat has no own times -> first half of the training; bench keeps its own span.
    expect(session.segments[0]).toMatchObject({startMs: START, endMs: START + 45 * 60000});
    expect(session.segments[1]).toMatchObject({startMs: START + 45 * 60000, endMs: START + 70 * 60000});
    expect(session.notes).toBe(
      'Low bar squat: 2 × (5 × 140 kg @ RIR 2), 3 × 150 kg @ RIR 1\nBench press competition: 8 × 90 kg @ RIR 2',
    );
  });

  it('keeps segments ordered, non-overlapping and inside the session', () => {
    const session = mapTrainingToHealthConnectSession(training(), workoutsById, exercisesById)!;
    session.segments.forEach((segment, i) => {
      expect(segment.startMs).toBeGreaterThanOrEqual(session.startMs);
      expect(segment.endMs).toBeLessThanOrEqual(session.endMs);
      expect(segment.endMs).toBeGreaterThan(segment.startMs);
      if (i > 0) expect(segment.startMs).toBeGreaterThanOrEqual(session.segments[i - 1].endMs);
    });
  });

  it('returns null for trainings that cannot be written', () => {
    expect(mapTrainingToHealthConnectSession(training({state: TrainingsState.STARTED}), workoutsById, exercisesById)).toBeNull();
    expect(mapTrainingToHealthConnectSession(training({end: undefined}), workoutsById, exercisesById)).toBeNull();
    expect(
      mapTrainingToHealthConnectSession(training({end: new Date(START - 1).toISOString() as any}), workoutsById, exercisesById),
    ).toBeNull();
    expect(
      mapTrainingToHealthConnectSession(training({exercises: [3], doneWorkoutIds: {3: 30}}), workoutsById, exercisesById),
    ).toBeNull();
  });
});
