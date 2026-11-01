import {sum} from 'lodash';
import {Accumulation} from '../models/Accumulation';
import {AccumulationMode} from '../models/AccumulationMode';
import {Training} from '../models/entities/Training';
import {TrainingsState} from '../models/TrainingsState';
import {handleAccumulationModeBatching} from './HandleAccumulationModeBatching';
import {getTrainingDurationMinutes} from './training-times';

const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

export interface CompletedTrainingLength {
  key: string;
  trainingId?: number;
  start: Date;
  end: Date;
  durationMinutes: number;
}

export interface TrainingLengthBucket {
  key: string;
  startDate: Date;
  x: number;
  averageDurationMinutes: number;
  totalDurationMinutes: number;
  trainingCount: number;
  trainings: CompletedTrainingLength[];
}

export const getCompletedTrainingDurationMinutes = (training: Training): number | null => {
  if (training.state !== TrainingsState.FINISHED || training.start === undefined || training.end === undefined) {
    return null;
  }

  return getTrainingDurationMinutes(training.start, training.end);
};

const toCompletedTrainingLength = (training: Training): CompletedTrainingLength | null => {
  const durationMinutes = getCompletedTrainingDurationMinutes(training);
  if (durationMinutes === null || training.start === undefined || training.end === undefined) {
    return null;
  }

  const start = new Date(training.start);
  const end = new Date(training.end);

  return {
    key: `${training.id ?? start.toISOString()}-${end.toISOString()}`,
    trainingId: training.id,
    start,
    end,
    durationMinutes,
  };
};

/**
 * GH-458 (H6): a training that was never finished properly counts 44 h 27 min.
 * That single value scales the Y axis to 2500 minutes and squashes every real
 * session (~60–90 min) into an unreadable strip along the bottom; in the month
 * view it drags the averages up (January ≈ 350 min). The screen exists to
 * answer "how long do I train?" and could not.
 *
 * Sessions longer than this are treated as implausible and left out of the
 * scaling and the averages by default. They are never hidden from the user:
 * their count is stated and they can be shown or corrected.
 */
export const IMPLAUSIBLE_TRAINING_DURATION_MINUTES = 4 * 60;

export const isImplausibleTrainingLength = (durationMinutes: number) => durationMinutes > IMPLAUSIBLE_TRAINING_DURATION_MINUTES;

export interface TrainingLengthAggregation {
  buckets: TrainingLengthBucket[];
  /** The implausible sessions that were left out of `buckets`. */
  excludedTrainings: CompletedTrainingLength[];
}

/**
 * Splits the completed trainings of a range into the plausible ones and the
 * implausible outliers, without touching stored data — a 44 h training stays
 * stored exactly as it is and is only presented differently.
 */
export const partitionTrainingLengths = (trainings: Training[]) => {
  const completedTrainings = trainings.flatMap((training) => {
    const completedTraining = toCompletedTrainingLength(training);
    return completedTraining ? [completedTraining] : [];
  });

  return {
    allTrainings: completedTrainings,
    plausibleTrainings: completedTrainings.filter((training) => !isImplausibleTrainingLength(training.durationMinutes)),
    implausibleTrainings: completedTrainings.filter((training) => isImplausibleTrainingLength(training.durationMinutes)),
  };
};

/**
 * `excludeOutliers` defaults to `false` so existing callers keep the behaviour
 * they had; the Training Length screen opts in and offers the toggle.
 */
export const aggregateTrainingLengths = (trainings: Training[], accumulationMode: AccumulationMode, excludeOutliers = false): TrainingLengthBucket[] => {
  const {allTrainings, plausibleTrainings} = partitionTrainingLengths(trainings);
  const completedTrainings = excludeOutliers ? plausibleTrainings : allTrainings;
  const groupedTrainings = completedTrainings.reduce(
    handleAccumulationModeBatching(completedTrainings, new Accumulation(accumulationMode)),
    new Map<string, CompletedTrainingLength[]>(),
  );

  return Array.from(groupedTrainings.entries())
    .map(([key, trainingsForBucket]) => {
      const bucketTrainings = [...trainingsForBucket].sort((left, right) => left.start.getTime() - right.start.getTime());
      const startDate = new Date(key);
      const totalDurationMinutes = Math.round(sum(bucketTrainings.map((training) => training.durationMinutes)));
      const trainingCount = bucketTrainings.length;

      return {
        key,
        startDate,
        x: startDate.getTime() / MILLISECONDS_IN_DAY,
        averageDurationMinutes: Math.round(totalDurationMinutes / trainingCount),
        totalDurationMinutes,
        trainingCount,
        trainings: bucketTrainings,
      };
    })
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
};

export const formatTrainingLength = (totalDurationMinutes: number) => {
  const roundedDurationMinutes = Math.round(totalDurationMinutes);
  const hours = Math.floor(roundedDurationMinutes / 60);
  const remainingMinutes = roundedDurationMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
};

export const getTrainingLengthBucketLabel = (startDate: Date, accumulationMode: AccumulationMode) => {
  switch (accumulationMode) {
    case AccumulationMode.WEEK:
      return `Week of ${startDate.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
    case AccumulationMode.MONTH:
      return startDate.toLocaleDateString('en-GB', {month: 'short', year: 'numeric'});
    case AccumulationMode.SINGLE_DAY:
    default:
      return startDate.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'});
  }
};

export const getTrainingLengthAxisPattern = (accumulationMode: AccumulationMode) => (accumulationMode === AccumulationMode.MONTH ? 'MMM yy' : 'dd MMM');

export const getTrainingLengthBarWidth = (accumulationMode: AccumulationMode) => {
  switch (accumulationMode) {
    case AccumulationMode.WEEK:
      return 6;
    case AccumulationMode.MONTH:
      return 24;
    case AccumulationMode.SINGLE_DAY:
    default:
      return 0.8;
  }
};

export const formatTrainingLengthDate = (date: Date) =>
  date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * Find the bucket whose x value is nearest to selectedX.
 *
 * Using nearest-bucket matching rather than a tight tolerance avoids float-precision
 * failures caused by epoch-day x values being fractional in non-UTC time zones and
 * by the native chart library returning slightly imprecise float values on tap.
 */
export const findBucketByX = (buckets: TrainingLengthBucket[], selectedX: number): TrainingLengthBucket | null => {
  if (buckets.length === 0) {
    return null;
  }

  return buckets.reduce((closest, bucket) =>
    Math.abs(bucket.x - selectedX) < Math.abs(closest.x - selectedX) ? bucket : closest,
  );
};
