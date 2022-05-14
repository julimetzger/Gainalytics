import {Action} from 'redux';

export const addExercise = (nameOfExercise: String) =>
  ({
    type: 'ADD_EXERCISE',
    nameOfExercise,
  } as Action);
