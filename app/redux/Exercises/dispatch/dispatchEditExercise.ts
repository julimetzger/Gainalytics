import {Action} from 'redux';
import {useDispatch} from 'react-redux';

import {MusclePercentPair} from '../../../models/entities/Exercise';
import {HealthConnectSegmentKey} from '../../../models/HealthConnectSegmentType';

export const dispatchEditExercise = () => {
  const dispatch = useDispatch();

  /** GH-528: `healthConnectType` null = automatic (name rule), undefined = keep the current choice. */
  return (exerciseId: number, nameOfExercise: String, muscles: MusclePercentPair[], alternativeIds?: number[], isFocus?: boolean, healthConnectType?: HealthConnectSegmentKey | null) =>
    dispatch({
      type: 'EDIT_EXERCISE',
      exerciseId,
      nameOfExercise,
      muscles,
      alternativeIds,
      isFocus,
      healthConnectType,
    } as Action);
};
