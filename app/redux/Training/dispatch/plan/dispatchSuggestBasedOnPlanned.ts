import {Action} from 'redux';
import {useDispatch} from 'react-redux';
import {useNextTrainingsId} from '../../use/useNextTrainingsId';
import {useLastTrainingInMicro} from '../../use/useLastTrainingInMicro';
import {useNextWorkoutId} from '../../../Workout/use/useNextWorkoutId';
import {useWorkoutsByIds} from '../../../Workout/use/useWorkoutsByIds';
import {Workout} from '../../../../models/Workout';

export const dispatchSuggestBasedOnPlanned = (trainingsPlanId: number, trainingsNumber: number) => {
  const dispatch = useDispatch();
  let nextTrainingsId = useNextTrainingsId();
  let nextWorkoutId = useNextWorkoutId();
  let lastTrainingInMicro = useLastTrainingInMicro(trainingsPlanId, trainingsNumber);
  let workouts = useWorkoutsByIds(lastTrainingInMicro?.plannedWorkouts ? Object.values(lastTrainingInMicro.plannedWorkouts) : []);
  if (lastTrainingInMicro?.plannedWorkouts ? Object.values(lastTrainingInMicro.plannedWorkouts).length > 0 : false) {
    let map = workouts.map((workout, index) => [nextWorkoutId + index, workout] as [number, Workout]);
    let workoutIdWorkoutMap = new Map(map);
    return (trainingsPlanId: number, microNumber: number, trainingInMicroNumber: number) =>
      dispatch({
        type: 'SUGGEST_TRAINING',
        trainingsPlanId,
        microNumber,
        trainingInMicroNumber,
        nextTrainingsId,
        lastTrainingInMicro,
        workoutIdWorkoutMap,
      } as Action);
  }
};
