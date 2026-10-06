import {useDispatch} from 'react-redux';
import {Action} from 'redux';

interface ClearPlannedTrainingActionParams {
  trainingsId: number;
  workoutIds: number[];
}

// GH-442: empties a PLANNED training (exercises + planned workouts) but keeps the
// training itself and its slot in the plan, so it can be planned again right away.
export const dispatchClearPlannedTraining = () => {
  const dispatch = useDispatch();

  return ({trainingsId, workoutIds}: ClearPlannedTrainingActionParams) =>
    dispatch({
      type: 'CLEAR_PLANNED_TRAINING',
      trainingsId,
      workoutIds,
    } as Action);
};
