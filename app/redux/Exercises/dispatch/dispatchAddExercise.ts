import {useDispatch} from 'react-redux';
import {Action} from 'redux';

import {MusclePercentPair} from '../../../models/entities/Exercise';

export const useDispatchAddExercise = () => {
  const dispatch = useDispatch();

  return (nameOfExercise: String, muscles: MusclePercentPair[], alternativeIds?: number[], isFocus?: boolean) =>
    dispatch({
      type: 'ADD_EXERCISE',
      nameOfExercise,
      muscles,
      alternativeIds,
      isFocus: isFocus ?? false,
    } as Action);
};
