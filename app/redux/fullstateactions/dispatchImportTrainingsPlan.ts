import {useDispatch} from 'react-redux';
import {TrainingsPlanExportPayload} from '../../../utils/exportTrainingsPlan';

export const useDispatchImportTrainingsPlan = () => {
  const dispatch = useDispatch();
  return (payload: TrainingsPlanExportPayload) => {
    dispatch({
      type: 'IMPORT_TRAININGS_PLAN',
      payload,
    });
  };
};
