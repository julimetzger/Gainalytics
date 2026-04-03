import {Action} from 'redux';
import {useDispatch} from 'react-redux';

import {MusclePercentPair} from '../../../models/entities/Exercise';

export const dispatchEditExercise = () => {
  const dispatch = useDispatch();

  return (exerciseId: number, nameOfExercise: String, muscles: MusclePercentPair[], alternativeIds?: number[]) =>
    dispatch({
      type: 'EDIT_EXERCISE',
      exerciseId,
      nameOfExercise,
      muscles,
      alternativeIds,
    } as Action);
};
