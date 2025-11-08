import {useDispatch} from 'react-redux';
import {Action} from 'redux';

const dispatchChangeTrainingsName = () => {
  let dispatch = useDispatch();
  return (trainingsPlanId: number, trainingsName: string, trainingsNumber: number) =>
    dispatch({
      type: 'CHANGE_TRAININGS_NAME',
      trainingsPlanId,
      trainingsName,
      trainingsNumber,
    } as Action);
};

export default dispatchChangeTrainingsName;
