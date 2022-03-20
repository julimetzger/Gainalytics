import {AnyAction} from '@reduxjs/toolkit';
import {ExerciseState} from '../rootReducer';

const initialState = {
  exercises: [
    {name: 'Bankdrücken', workouts: []},
    {name: 'Squat', workouts: []},
    {name: 'Deadlift', workouts: []},
  ] as Exercise[],
};

const exerciseReducer = (state: ExerciseState = initialState, action: AnyAction) => {
  switch (action.type) {
    case 'ADD_SET_TO_TRAINING': {
      const excercises: Exercise[] = [...state.exercises];
      excercises.find((it) => it === action.exercise)?.workouts.push(action.workout);
      return {
        ...state,
        exercises: excercises,
      };
    }
    default:
      return state;
  }
};

export default exerciseReducer;
