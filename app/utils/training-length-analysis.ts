import {sum} from 'lodash';
import {Accumulation} from '../components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../models/AccumulationMode';
import {Training} from '../models/entities/Training';
import {TrainingsState} from '../models/TrainingsState';
import {handleAccumulationModeBatching} from './HandleAccumulationModeBatching';

const MILLISECONDS_IN_MINUTE = 1000 * 60;
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

  const durationInMilliseconds = new Date(training.end).getTime() - new Date(training.start).getTime();
  if (durationInMilliseconds <= 0) {
    return null;
  }

  return durationInMilliseconds / MILLISECONDS_IN_MINUTE;
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

export const aggregateTrainingLengths = (trainings: Training[], accumulationMode: AccumulationMode): TrainingLengthBucket[] => {
  const completedTrainings = trainings.flatMap((training) => {
    const completedTraining = toCompletedTrainingLength(training);
    return completedTraining ? [completedTraining] : [];
  });
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
