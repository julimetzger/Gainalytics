const initialState = {
  exercises: [{name: 'Bankdrücken'}, {name: 'Squat'}, {name: 'Deadlift'}],
};

const exerciseReducer = (state = initialState, action) => {
  switch (action.type) {
    default:
      return state;
  }
};

export default exerciseReducer;
