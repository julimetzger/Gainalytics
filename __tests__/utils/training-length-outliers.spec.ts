import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Training} from '../../app/models/entities/Training';
import {TrainingsState} from '../../app/models/TrainingsState';
import {
  IMPLAUSIBLE_TRAINING_DURATION_MINUTES,
  aggregateTrainingLengths,
  isImplausibleTrainingLength,
  partitionTrainingLengths,
} from '../../app/utils/training-length-analysis';

/**
 * GH-458 (H6): the fixture holds a training from 12/01/2026 that was never
 * finished and therefore counts 44 h 27 min. That one value scaled the Y axis
 * to 2500 minutes, squashing every real 60–90 min session into a strip along
 * the bottom, and dragged January's monthly average to ≈ 350 min.
 */

const makeTraining = (id: number, start: Date, end: Date): Training =>
  ({id, state: TrainingsState.FINISHED, start, end, workouts: []} as unknown as Training);

// Three plausible January sessions of 60, 90 and 75 minutes …
const NORMAL_TRAININGS = [
  makeTraining(1, new Date(2026, 0, 5, 18, 0), new Date(2026, 0, 5, 19, 0)),
  makeTraining(2, new Date(2026, 0, 7, 18, 0), new Date(2026, 0, 7, 19, 30)),
  makeTraining(3, new Date(2026, 0, 9, 18, 0), new Date(2026, 0, 9, 19, 15)),
];

// … and the 44 h 27 min outlier from the baseline fixture.
const OUTLIER = makeTraining(4, new Date(2026, 0, 12, 22, 0), new Date(2026, 0, 14, 18, 27));

describe('implausible training lengths (GH-458 H6)', () => {
  it('treats anything over four hours as implausible', () => {
    expect(IMPLAUSIBLE_TRAINING_DURATION_MINUTES).toBe(240);
    expect(isImplausibleTrainingLength(239)).toBe(false);
    expect(isImplausibleTrainingLength(240)).toBe(false);
    expect(isImplausibleTrainingLength(241)).toBe(true);
  });

  it('separates the outlier from the real sessions without dropping it', () => {
    const {allTrainings, plausibleTrainings, implausibleTrainings} = partitionTrainingLengths([...NORMAL_TRAININGS, OUTLIER]);

    expect(allTrainings).toHaveLength(4);
    expect(plausibleTrainings.map((training) => training.trainingId)).toEqual([1, 2, 3]);
    expect(implausibleTrainings.map((training) => training.trainingId)).toEqual([4]);
    expect(Math.round(implausibleTrainings[0].durationMinutes)).toBe(2667); // 44 h 27 min
  });

  describe('day view', () => {
    it('drops the outlier bucket from the scaling when outliers are excluded', () => {
      const buckets = aggregateTrainingLengths([...NORMAL_TRAININGS, OUTLIER], AccumulationMode.SINGLE_DAY, true);

      expect(buckets).toHaveLength(3);
      expect(Math.max(...buckets.map((bucket) => bucket.averageDurationMinutes))).toBe(90);
    });

    it('keeps the 2667-minute bar when the user asks to see it', () => {
      const buckets = aggregateTrainingLengths([...NORMAL_TRAININGS, OUTLIER], AccumulationMode.SINGLE_DAY, false);

      expect(buckets).toHaveLength(4);
      expect(Math.max(...buckets.map((bucket) => bucket.averageDurationMinutes))).toBe(2667);
    });
  });

  describe('month view', () => {
    it('no longer lets the outlier drag the monthly average', () => {
      const withOutlier = aggregateTrainingLengths([...NORMAL_TRAININGS, OUTLIER], AccumulationMode.MONTH, false);
      const withoutOutlier = aggregateTrainingLengths([...NORMAL_TRAININGS, OUTLIER], AccumulationMode.MONTH, true);

      expect(withOutlier).toHaveLength(1);
      expect(withoutOutlier).toHaveLength(1);
      // (60 + 90 + 75 + 2667) / 4 ≈ 723 vs the truthful (60 + 90 + 75) / 3 = 75
      expect(withOutlier[0].averageDurationMinutes).toBeGreaterThan(300);
      expect(withoutOutlier[0].averageDurationMinutes).toBe(75);
      expect(withoutOutlier[0].trainingCount).toBe(3);
    });
  });

  it('defaults to the previous behaviour for callers that do not opt in', () => {
    const buckets = aggregateTrainingLengths([...NORMAL_TRAININGS, OUTLIER], AccumulationMode.SINGLE_DAY);

    expect(buckets).toHaveLength(4);
  });

  it('leaves a range without outliers completely unchanged', () => {
    const excluded = aggregateTrainingLengths(NORMAL_TRAININGS, AccumulationMode.SINGLE_DAY, true);
    const included = aggregateTrainingLengths(NORMAL_TRAININGS, AccumulationMode.SINGLE_DAY, false);

    expect(excluded).toEqual(included);
  });
});
