import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {StrongCsvState} from '../../../utils/strongCsv/strongExport';

/**
 * GH-496: the slices the Strong CSV export/import works on, subscribed via selectors, so an
 * import preview is recomputed whenever the data it is based on changes.
 */
export const useStrongCsvState = (): StrongCsvState => {
  const exercises = useSelector((state: GlobalState) => state.exercises);
  const workouts = useSelector((state: GlobalState) => state.workouts);
  const trainings = useSelector((state: GlobalState) => state.trainings);
  const trainingsPlan = useSelector((state: GlobalState) => state.trainingsPlan);
  return useMemo(() => ({exercises, workouts, trainings, trainingsPlan}), [exercises, workouts, trainings, trainingsPlan]);
};
