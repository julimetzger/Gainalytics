import {sum} from 'lodash';
import {Accumulation} from '../components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../models/AccumulationMode';
import {Training} from '../models/entities/Training';
import {TrainingsState} from '../models/TrainingsState';
import {handleAccumulationModeBatching} from './HandleAccumulationModeBatching';

const MILLISECONDS_IN_MINUTE = 1000 * 60;
const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

export interface TrainingLengthBucket {
  key: string;
  startDate: Date;
  x: number;
  totalDurationMinutes: number;
  trainingCount: number;
  trainingIds: number[];
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

export const aggregateTrainingLengths = (trainings: Training[], accumulationMode: AccumulationMode): TrainingLengthBucket[] => {
  const completedTrainings = trainings.filter((training) => getCompletedTrainingDurationMinutes(training) !== null);
  const groupedTrainings = completedTrainings.reduce(
    handleAccumulationModeBatching(completedTrainings, new Accumulation(accumulationMode)),
    new Map<string, Training[]>(),
  );

  return Array.from(groupedTrainings.entries())
    .map(([key, trainingsForBucket]) => {
      const bucketTrainings = trainingsForBucket.filter(
        (training): training is Training =>
          'doneWorkoutIds' in training && 'plannedWorkouts' in training && 'exercises' in training && 'state' in training,
      );
      const startDate = new Date(key);
      const totalDurationMinutes = Math.round(sum(bucketTrainings.map((training) => getCompletedTrainingDurationMinutes(training) ?? 0)));
      const trainingIds = bucketTrainings.flatMap((training) => (typeof training.id === 'number' ? [training.id] : []));

      return {
        key,
        startDate,
        x: startDate.getTime() / MILLISECONDS_IN_DAY,
        totalDurationMinutes,
        trainingCount: bucketTrainings.length,
        trainingIds,
      };
    })
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
};

export const formatTrainingLength = (totalDurationMinutes: number) => {
  const hours = Math.floor(totalDurationMinutes / 60);
  const remainingMinutes = totalDurationMinutes % 60;

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
