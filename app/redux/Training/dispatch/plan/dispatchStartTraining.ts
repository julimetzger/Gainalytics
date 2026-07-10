import {Action} from 'redux';
import {useDispatch} from 'react-redux';
import {useTraining} from '../../use/useTraining';
import {TrainingsState} from '../../../../models/TrainingsState';

export const dispatchStartTraining = (trainingsId?: number) => {
  const dispatch = useDispatch();
  let training = useTraining(trainingsId);

  return () => {
    let plannedWorkouts: number[] = [];
    let finishedWorkouts: number[] = [];
    if (training) {
      let finishedExercises = Object.keys(training.doneWorkoutIds).map((exerciseId: string) => parseInt(exerciseId));
      finishedWorkouts = finishedExercises.map((exerciseId: number) => {
        return training!!.doneWorkoutIds[exerciseId];
      });
      plannedWorkouts = Object.keys(training.plannedWorkouts)
        .map((exerciseId: string) => parseInt(exerciseId))
        .filter((exerciseId: number) => !finishedExercises.includes(exerciseId))
        .map((exerciseId: number) => {
          return training!!.plannedWorkouts[exerciseId];
        });
    }
    // The rest timer is a single global slot in settings.restTimer.active — it is not
    // scoped to a training. If a previous training's last set is still within the rest
    // window (or the timer was never dismissed), a freshly started training would show
    // that stale countdown/overrun instead of starting clean. Only clear it on the actual
    // PLANNED/FINISHED -> STARTED transition, matching the trainingsReducer's own
    // already-STARTED guard, so re-entering an in-progress training never kills a
    // legitimately running rest timer.
    if (training?.state !== TrainingsState.STARTED) {
      dispatch({type: 'DISMISS_REST_TIMER'} as Action);
    }
    dispatch({
      type: 'START_TRAINING',
      trainingsId,
      workoutIds: plannedWorkouts,
      finishedWorkoutIds: finishedWorkouts,
      date: new Date().getTime(),
    } as Action);
  };
};
