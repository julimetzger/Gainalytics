import {Action} from 'redux';
import {useDispatch} from 'react-redux';
import {useNextTrainingsId} from '../../use/useNextTrainingsId';
import {useLastTrainingInMicro} from '../../use/useLastTrainingInMicro';
import {useNextWorkoutId} from '../../../Workout/use/useNextWorkoutId';
import {useWorkoutsByIds} from '../../../Workout/use/useWorkoutsByIds';
import {Workout} from '../../../../models/entities/Workout';
import {
  applyLinearProgressionToWorkout,
  DEFAULT_SUGGESTION_PROGRESSION_PROFILE,
  SuggestionProgressionProfile,
} from '../../../../utils/AnalyseUtils';

export const dispatchSuggestBasedOnTrained = (
  trainingsPlanId: number,
  trainingsNumber: number,
  progressionProfile: SuggestionProgressionProfile = DEFAULT_SUGGESTION_PROGRESSION_PROFILE,
) => {
  const dispatch = useDispatch();
  let nextTrainingsId = useNextTrainingsId();
  let nextWorkoutId = useNextWorkoutId();
  let lastTrainingInMicro = useLastTrainingInMicro(trainingsPlanId, trainingsNumber);
  const doneWorkoutIds = lastTrainingInMicro?.doneWorkoutIds ? Object.values(lastTrainingInMicro.doneWorkoutIds) : [];
  let workouts = useWorkoutsByIds(doneWorkoutIds);
  if (doneWorkoutIds.length > 0) {
    let map = workouts.map((workout, index) => [nextWorkoutId + index, applyLinearProgressionToWorkout(workout, progressionProfile)] as [number, Workout]);
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
