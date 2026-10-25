import {useDispatch} from 'react-redux';
import {Action} from 'redux';

import {MusclePercentPair} from '../../../models/entities/Exercise';
import {HealthConnectSegmentKey} from '../../../models/HealthConnectSegmentType';

export const useDispatchAddExercise = () => {
  const dispatch = useDispatch();

  return (nameOfExercise: String, muscles: MusclePercentPair[], alternativeIds?: number[], isFocus?: boolean, healthConnectType?: HealthConnectSegmentKey | null) =>
    dispatch({
      type: 'ADD_EXERCISE',
      nameOfExercise,
      muscles,
      alternativeIds,
      isFocus: isFocus ?? false,
      healthConnectType,
    } as Action);
};
