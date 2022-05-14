import {Action} from 'redux';

export const addSetToTraining = (workout: Workout, exercise: Exercise) =>
  ({
    type: 'ADD_SET_TO_TRAINING',
    workout,
    exercise,
  } as Action);
