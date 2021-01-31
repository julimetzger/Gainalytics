const initialState = {
  exercises: [
    {name: 'Bankdrücken', trainings: []},
    {name: 'Squat', trainings: []},
    {name: 'Deadlift', trainings: []},
  ],
};

const exerciseReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'ADD_SET_TO_TRAINING': {
      state.exercises
        .find((exercise) => exercise.name === action.exercise.name)
        .trainings.push({
          date: action.date,
          weight: action.exercise.weight,
          reps: action.exercise.reps,
          rpe: action.exercise.rpe,
        });
      return state;
    }
    default:
      return state;
  }
};

export default exerciseReducer;
