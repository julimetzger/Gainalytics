import {useRef} from 'react';
import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {useNextTrainingsId} from '../../use/useNextTrainingsId';
import {useNextWorkoutId} from '../../../Workout/use/useNextWorkoutId';
import {Workout} from '../../../../models/entities/Workout';

export const dispatchAddPlanedTrainingWorkout = () => {
  const dispatch = useDispatch();
  let nextTrainingsId = useNextTrainingsId();
  let nextWorkoutId = useNextWorkoutId();
  // GH-324: the caller can invoke this dispatcher for several different
  // exercises back-to-back within the same event handler (e.g. leaving full
  // edit commits one still-unsaved set per exercise in a synchronous loop).
  // `nextWorkoutId` above is only refreshed on the next render, so without a
  // local counter every call in that loop would allocate the SAME workout id
  // and each dispatch would clobber the previous exercise's workout. Track the
  // next id to hand out in a ref, reseeded from the selector every render, and
  // increment it on every allocation so back-to-back calls stay unique.
  const nextWorkoutIdRef = useRef(nextWorkoutId);
  nextWorkoutIdRef.current = nextWorkoutId;

  return (trainingsPlanId: number, microNumber: number, trainingInMicroNumber: number, exerciseId: number, workout: Workout, trainingsId?: number) =>
    dispatch({
      type: 'ADD_PLANED_TRAINING_WORKOUT',
      trainingsPlanId,
      microNumber,
      trainingInMicroNumber,
      exerciseId,
      workout,
      nextTrainingsId,
      nextWorkoutId: workout.id ?? nextWorkoutIdRef.current++,
      trainingsId,
    } as Action);
};
