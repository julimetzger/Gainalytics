const initialState = {
  exercises: [{name: 'Bankdrücken'}, {name: 'Squat'}, {name: 'Deadlift'}],
};

const exerciseReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'GET_EXERCISES':
      return state.exercises;
    default:
      return state;
  }
};

export default exerciseReducer;
