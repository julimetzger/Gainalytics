import {Action} from 'redux';
import {useDispatch} from 'react-redux';
import {useTraining} from '../../use/useTraining';

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
    dispatch({
      type: 'START_TRAINING',
      trainingsId,
      workoutIds: plannedWorkouts,
      finishedWorkoutIds: finishedWorkouts,
      date: new Date().getTime(),
    } as Action);
  };
};
