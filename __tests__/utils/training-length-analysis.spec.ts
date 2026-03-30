import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Training} from '../../app/models/entities/Training';
import {TrainingsState} from '../../app/models/TrainingsState';
import {aggregateTrainingLengths, findBucketByX, formatTrainingLength, TrainingLengthBucket} from '../../app/utils/training-length-analysis';

const createTraining = (training: Partial<Training>) =>
  ({
    id: training.id,
    doneWorkoutIds: training.doneWorkoutIds ?? {},
    plannedWorkouts: training.plannedWorkouts ?? {},
    exercises: training.exercises ?? [],
    notes: training.notes,
    start: training.start,
    end: training.end,
    state: training.state ?? TrainingsState.PLANNED,
  }) satisfies Training;

const createCompletedTrainingLength = ({id, start, end}: {id: number; start: Date; end: Date}) => ({
  key: `${id}-${end.toISOString()}`,
  trainingId: id,
  start,
  end,
  durationMinutes: (end.getTime() - start.getTime()) / (1000 * 60),
});

describe('training-length-analysis', () => {
  it('aggregates completed training duration by day, week, and month while ignoring incomplete trainings', () => {
    const trainingOneStart = new Date('2026-03-03T10:00:00.000Z');
    const trainingOneEnd = new Date('2026-03-03T11:30:00.000Z');
    const trainingTwoStart = new Date('2026-03-05T14:00:00.000Z');
    const trainingTwoEnd = new Date('2026-03-05T15:00:00.000Z');
    const trainingThreeStart = new Date('2026-04-02T09:00:00.000Z');
    const trainingThreeEnd = new Date('2026-04-02T11:15:00.000Z');
    const trainings = [
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: trainingOneStart,
        end: trainingOneEnd,
      }),
      createTraining({
        id: 2,
        state: TrainingsState.FINISHED,
        start: trainingTwoStart,
        end: trainingTwoEnd,
      }),
      createTraining({
        id: 3,
        state: TrainingsState.FINISHED,
        start: trainingThreeStart,
        end: trainingThreeEnd,
      }),
      createTraining({
        id: 4,
        state: TrainingsState.PLANNED,
        start: new Date('2026-03-06T09:00:00.000Z'),
      }),
      createTraining({
        id: 5,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-07T09:00:00.000Z'),
      }),
    ];

    const marchThird = new Date(2026, 2, 3);
    marchThird.setHours(0, 0, 0, 0);
    const marchFifth = new Date(2026, 2, 5);
    marchFifth.setHours(0, 0, 0, 0);
    const aprilSecond = new Date(2026, 3, 2);
    aprilSecond.setHours(0, 0, 0, 0);
    const marchSecondWeekStart = new Date(2026, 2, 2);
    marchSecondWeekStart.setHours(0, 0, 0, 0);
    const marchThirtiethWeekStart = new Date(2026, 2, 30);
    marchThirtiethWeekStart.setHours(0, 0, 0, 0);
    const marchMonthStart = new Date(2026, 2, 1);
    marchMonthStart.setHours(0, 0, 0, 0);
    const aprilMonthStart = new Date(2026, 3, 1);
    aprilMonthStart.setHours(0, 0, 0, 0);

    expect(aggregateTrainingLengths(trainings, AccumulationMode.SINGLE_DAY)).toEqual([
      {
        key: marchThird.toISOString(),
        startDate: new Date(marchThird),
        x: marchThird.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 90,
        totalDurationMinutes: 90,
        trainingCount: 1,
        trainings: [createCompletedTrainingLength({id: 1, start: trainingOneStart, end: trainingOneEnd})],
      },
      {
        key: marchFifth.toISOString(),
        startDate: new Date(marchFifth),
        x: marchFifth.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 60,
        totalDurationMinutes: 60,
        trainingCount: 1,
        trainings: [createCompletedTrainingLength({id: 2, start: trainingTwoStart, end: trainingTwoEnd})],
      },
      {
        key: aprilSecond.toISOString(),
        startDate: new Date(aprilSecond),
        x: aprilSecond.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 135,
        totalDurationMinutes: 135,
        trainingCount: 1,
        trainings: [createCompletedTrainingLength({id: 3, start: trainingThreeStart, end: trainingThreeEnd})],
      },
    ]);

    expect(aggregateTrainingLengths(trainings, AccumulationMode.WEEK)).toEqual([
      {
        key: marchSecondWeekStart.toISOString(),
        startDate: new Date(marchSecondWeekStart),
        x: marchSecondWeekStart.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 75,
        totalDurationMinutes: 150,
        trainingCount: 2,
        trainings: [
          createCompletedTrainingLength({id: 1, start: trainingOneStart, end: trainingOneEnd}),
          createCompletedTrainingLength({id: 2, start: trainingTwoStart, end: trainingTwoEnd}),
        ],
      },
      {
        key: marchThirtiethWeekStart.toISOString(),
        startDate: new Date(marchThirtiethWeekStart),
        x: marchThirtiethWeekStart.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 135,
        totalDurationMinutes: 135,
        trainingCount: 1,
        trainings: [createCompletedTrainingLength({id: 3, start: trainingThreeStart, end: trainingThreeEnd})],
      },
    ]);

    expect(aggregateTrainingLengths(trainings, AccumulationMode.MONTH)).toEqual([
      {
        key: marchMonthStart.toISOString(),
        startDate: new Date(marchMonthStart),
        x: marchMonthStart.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 75,
        totalDurationMinutes: 150,
        trainingCount: 2,
        trainings: [
          createCompletedTrainingLength({id: 1, start: trainingOneStart, end: trainingOneEnd}),
          createCompletedTrainingLength({id: 2, start: trainingTwoStart, end: trainingTwoEnd}),
        ],
      },
      {
        key: aprilMonthStart.toISOString(),
        startDate: new Date(aprilMonthStart),
        x: aprilMonthStart.getTime() / (1000 * 60 * 60 * 24),
        averageDurationMinutes: 135,
        totalDurationMinutes: 135,
        trainingCount: 1,
        trainings: [createCompletedTrainingLength({id: 3, start: trainingThreeStart, end: trainingThreeEnd})],
      },
    ]);
  });

  it('formats duration values for the training length screen', () => {
    expect([
      formatTrainingLength(45),
      formatTrainingLength(60),
      formatTrainingLength(95),
    ]).toEqual(['45 min', '1 h', '1 h 35 min']);
  });
});

const makeBucket = (key: string, x: number): TrainingLengthBucket => ({
  key,
  startDate: new Date(key),
  x,
  averageDurationMinutes: 60,
  totalDurationMinutes: 60,
  trainingCount: 1,
  trainings: [],
});

describe('findBucketByX', () => {
  const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

  const bucketA = makeBucket('2026-03-03T00:00:00.000Z', new Date('2026-03-03T00:00:00.000Z').getTime() / MILLISECONDS_IN_DAY);
  const bucketB = makeBucket('2026-03-05T00:00:00.000Z', new Date('2026-03-05T00:00:00.000Z').getTime() / MILLISECONDS_IN_DAY);
  const bucketC = makeBucket('2026-04-02T00:00:00.000Z', new Date('2026-04-02T00:00:00.000Z').getTime() / MILLISECONDS_IN_DAY);

  it('returns null for an empty bucket list', () => {
    expect(findBucketByX([], bucketA.x)).toBeNull();
  });

  it('returns the exact-match bucket when selectedX equals bucket.x', () => {
    expect(findBucketByX([bucketA, bucketB, bucketC], bucketA.x)).toBe(bucketA);
    expect(findBucketByX([bucketA, bucketB, bucketC], bucketB.x)).toBe(bucketB);
    expect(findBucketByX([bucketA, bucketB, bucketC], bucketC.x)).toBe(bucketC);
  });

  it('matches the nearest bucket when selectedX has float-precision error (simulates non-UTC timezone tap)', () => {
    // Simulate a float error that is far larger than the old 0.0001 tolerance
    // (e.g. a timezone offset of UTC+1 causes an offset of 1/24 ≈ 0.0417 in epoch-day units)
    const floatErrorX = bucketB.x + 0.04;
    expect(findBucketByX([bucketA, bucketB, bucketC], floatErrorX)).toBe(bucketB);
  });

  it('selects the single bucket regardless of float drift', () => {
    const driftedX = bucketA.x + 0.1;
    expect(findBucketByX([bucketA], driftedX)).toBe(bucketA);
  });

  describe('toggle behavior via setSelectedBucketKey pattern', () => {
    it('first tap sets the key, second tap on the same bar clears it', () => {
      // Simulate the React state updater: (prev) => (prev === nextKey ? null : nextKey)
      const toggle = (prev: string | null, nextKey: string | null) => (prev === nextKey ? null : nextKey);

      const nextKey = bucketB.key;

      // First tap: no prior selection
      let state: string | null = null;
      state = toggle(state, nextKey);
      expect(state).toBe(nextKey);

      // Second tap on the same bar: should deselect
      state = toggle(state, nextKey);
      expect(state).toBeNull();

      // Tap on a different bar switches the selection
      state = toggle(state, bucketA.key);
      expect(state).toBe(bucketA.key);
      state = toggle(state, bucketB.key);
      expect(state).toBe(bucketB.key);
    });
  });
});
