import {Action} from 'redux';
import {useDispatch} from 'react-redux';

import {VelocityLossReference} from '../../../models/entities/Exercise';

export const dispatchSetExerciseVlReference = () => {
  const dispatch = useDispatch();

  return (exerciseId: number, vlReference: VelocityLossReference) =>
    dispatch({
      type: 'SET_EXERCISE_VL_REFERENCE',
      exerciseId,
      vlReference,
    } as Action);
};
