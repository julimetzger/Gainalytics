import {createSelector} from '@reduxjs/toolkit';
import {useSelector} from 'react-redux';
import {Range} from '../../../components/picker/date/DateRangePicker';
import {Training} from '../../../models/entities/Training';
import {TrainingsState} from '../../../models/TrainingsState';
import {NormalizedState} from '../../normalizedState';
import {GlobalState} from '../../rootReducer';

const selectTrainings = (state: GlobalState) => state.trainings;

const passRange = (_state: GlobalState, range: Range) => range;

const findCompletedTrainingsIn = (trainings: NormalizedState<Training>, range: Range) =>
  trainings.allIds
    .map((trainingId) => trainings.byId[trainingId])
    .filter((training) => {
      if (training.state !== TrainingsState.FINISHED || training.start === undefined || training.end === undefined) {
        return false;
      }

      const start = new Date(training.start).getTime();
      const end = new Date(training.end).getTime();
      return start > range.startDate.getTime() && end < range.endDate.getTime();
    });

const selector = createSelector(selectTrainings, passRange, (trainings, range) => findCompletedTrainingsIn(trainings, range));

export const useCompletedTrainingsIn = (range: Range) => useSelector((state: GlobalState) => selector(state, range));
