import {createSelector} from '@reduxjs/toolkit';
import {useSelector} from 'react-redux';
import {Training} from '../../../models/entities/Training';
import {TrainingsState} from '../../../models/TrainingsState';
import {NormalizedState} from '../../normalizedState';
import {GlobalState} from '../../rootReducer';

/**
 * GH-458 round 3 (review): Training Length charts finished `Training` entries,
 * not workouts. Its "your last training was on …" hint must name the newest
 * finished training, or the one-tap correction can land on a range the screen
 * still renders as empty.
 */
export const findLastCompletedTrainingDate = (trainings: NormalizedState<Training>): Date | undefined => {
  const newest = trainings.allIds.reduce<number | undefined>((current, id) => {
    const training = trainings.byId[id];
    if (training?.state !== TrainingsState.FINISHED || training.start === undefined || training.end === undefined) {
      return current;
    }

    const end = new Date(training.end).getTime();
    return Number.isFinite(end) && (current === undefined || end > current) ? end : current;
  }, undefined);

  return newest === undefined ? undefined : new Date(newest);
};

const selector = createSelector((state: GlobalState) => state.trainings, findLastCompletedTrainingDate);

export const useLastCompletedTrainingDate = () => useSelector(selector);
