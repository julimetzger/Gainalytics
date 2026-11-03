import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {TrainingsState} from '../../../models/TrainingsState';

export const useTrainings = () => useSelector((state: GlobalState) => state.trainings.allIds.map((value: number) => state.trainings.byId[value]));

/** GH-671: a boolean for the tab badge — unlike `useTrainings()` it does not change on every dispatch. */
export const selectIsAnyTrainingStarted = (state: GlobalState) =>
  state.trainings.allIds.some((id: number) => state.trainings.byId[id]?.state === TrainingsState.STARTED);
