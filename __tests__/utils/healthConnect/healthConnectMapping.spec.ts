import {
  describeSets,
  healthConnectFingerprint,
  HealthConnectSessionInput,
  mapTrainingToHealthConnectSession,
  segmentTypeForExercise,
  segmentTypeForName,
} from '../../../app/utils/healthConnect/healthConnectMapping';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {Exercise} from '../../../app/models/entities/Exercise';

const START = Date.UTC(2026, 9, 10, 17, 0);
const END = Date.UTC(2026, 9, 10, 18, 30);
const at = (min: number) => new Date(START + min * 60000);

const exercisesById: {[id: number]: Exercise} = {
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
  },
  20: {
    id: 20,
    exerciseId: 2,
    start: at(40),
    end: at(70),
    sets: [
      {reps: 8, weight: 90, rir: 2},
      {reps: 0, weight: 90, rir: 0},
    ],
  },
  30: {id: 30, exerciseId: 3, sets: []},
};

const training = (overrides: Partial<Training> = {}): Training => ({
  id: 7,
  state: TrainingsState.FINISHED,
  start: new Date(START),
  end: new Date(END),
  exercises: [1, 2, 3],
  doneWorkoutIds: {1: 10, 2: 20, 3: 30},
  plannedWorkouts: {},
  ...overrides,
});

const expectedSession: HealthConnectSessionInput = {
  clientRecordId: 'gainalytics-training-7',
  clientRecordVersion: 1234,
  title: 'Gainalytics: Low bar squat, Bench press competition',
  notes: 'Low bar squat: 2 × (5 × 140 kg @ RIR 2), 3 × 150 kg @ RIR 1\nBench press competition: 8 × 90 kg @ RIR 2',
  startMs: START,
  endMs: END,
  segments: [
    // Squat has no own times -> first half of the training; bench keeps its own span.
    {startMs: START, endMs: START + 45 * 60000, segmentType: 'SQUAT', repetitions: 13, exerciseName: 'Low bar squat'},
    {startMs: START + 45 * 60000, endMs: START + 70 * 60000, segmentType: 'BENCH_PRESS', repetitions: 8, exerciseName: 'Bench press competition'},
  ],
};

describe('GH-528 Health Connect mapping', () => {
  it('maps exercise names to Health Connect segment types, specific patterns first', () => {
    expect(
      ['Low bar squat', 'Bulgarian split squat', 'Leg press', 'Leg curl', 'Hammer curl', 'Romanian deadlift', 'Close grip bench', 'Overhead press', 'Barbell row', undefined].map(segmentTypeForName),
    ).toEqual(['SQUAT', 'LUNGE', 'LEG_PRESS', 'LEG_CURL', 'ARM_CURL', 'DEADLIFT', 'BENCH_PRESS', 'BARBELL_SHOULDER_PRESS', 'WEIGHTLIFTING', 'WEIGHTLIFTING']);
  });

  it('uses the type chosen in the exercise editor instead of the name rule', () => {
    expect(segmentTypeForExercise({name: 'Barbell row', healthConnectType: 'DUMBBELL_ROW'})).toBe('DUMBBELL_ROW');
    // A chosen type wins even where the rule would match something else.
    expect(segmentTypeForExercise({name: 'Pause squat', healthConnectType: 'LEG_PRESS'})).toBe('LEG_PRESS');
    expect(segmentTypeForExercise({name: 'Pause squat'})).toBe('SQUAT');
    expect(segmentTypeForExercise(undefined)).toBe('WEIGHTLIFTING');
  });

  it('groups identical consecutive sets in the notes text', () => {
    expect(describeSets(workoutsById[10].sets)).toBe('2 × (5 × 140 kg @ RIR 2), 3 × 150 kg @ RIR 1');
  });

  it('writes one segment per executed exercise with summed reps inside the session', () => {
    expect(mapTrainingToHealthConnectSession(training(), workoutsById, exercisesById, 1234)).toEqual(expectedSession);
  });

  it('writes the custom Health Connect type of an exercise into its segment', () => {
    const custom = {...exercisesById, 2: {id: 2, name: 'Bench press competition', healthConnectType: 'BARBELL_SHOULDER_PRESS' as const}};
    expect(mapTrainingToHealthConnectSession(training(), workoutsById, custom, 1234)).toEqual({
      ...expectedSession,
      segments: [expectedSession.segments[0], {...expectedSession.segments[1], segmentType: 'BARBELL_SHOULDER_PRESS'}],
    });
  });

  it('puts the training notes above the set protocol', () => {
    expect(mapTrainingToHealthConnectSession(training({notes: 'Felt strong'}), workoutsById, exercisesById, 1234)).toEqual({
      ...expectedSession,
      notes: `Felt strong\n\n${expectedSession.notes}`,
    });
  });

  it('keeps one segment per exercise when workouts overlap or are out of order (superset)', () => {
    const superset: {[id: number]: Workout} = {
      10: {...workoutsById[10], start: at(0), end: at(60)},
      // Done in between the squat sets: ends before the squat segment does.
      20: {...workoutsById[20], start: at(10), end: at(50)},
      30: {id: 30, exerciseId: 3, start: at(85), end: at(120), sets: [{reps: 10, weight: 60, rir: 2}]},
    };
    const session = mapTrainingToHealthConnectSession(training(), superset, exercisesById, 1234);

    expect(session?.segments).toEqual([
      {startMs: START, endMs: START + 60 * 60000, segmentType: 'SQUAT', repetitions: 13, exerciseName: 'Low bar squat'},
      // Its own span ended inside the squat segment: it gets an even share of the remaining time.
      {startMs: START + 60 * 60000, endMs: START + 75 * 60000, segmentType: 'BENCH_PRESS', repetitions: 8, exerciseName: 'Bench press competition'},
      {startMs: START + 85 * 60000, endMs: END, segmentType: 'WEIGHTLIFTING', repetitions: 10, exerciseName: 'Barbell row'},
    ]);
  });

  it('returns null for trainings that cannot be written', () => {
    expect(
      [
        training({state: TrainingsState.STARTED}),
        training({state: TrainingsState.PLANNED}),
        training({end: undefined}),
        training({end: new Date(START - 1)}),
        training({exercises: [3], doneWorkoutIds: {3: 30}}),
      ].map((it) => mapTrainingToHealthConnectSession(it, workoutsById, exercisesById)),
    ).toEqual([null, null, null, null, null]);
  });

  it('fingerprints the written content, ignoring the record version', () => {
    const first = mapTrainingToHealthConnectSession(training(), workoutsById, exercisesById, 1)!;
    const later = mapTrainingToHealthConnectSession(training(), workoutsById, exercisesById, 2)!;
    const edited = mapTrainingToHealthConnectSession(training(), {...workoutsById, 10: {...workoutsById[10], sets: [{reps: 5, weight: 145, rir: 2}]}}, exercisesById, 1)!;

    expect(healthConnectFingerprint(later)).toBe(healthConnectFingerprint(first));
    expect(healthConnectFingerprint(edited)).not.toBe(healthConnectFingerprint(first));
  });
});
