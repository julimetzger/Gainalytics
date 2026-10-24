import exerciseReducer from '../../../app/redux/Exercises/exercisesReducer';
import {Exercise} from '../../../app/models/entities/Exercise';
import {NormalizedState} from '../../../app/redux/normalizedState';

const state = (exercise: Exercise): NormalizedState<Exercise> => ({byId: {1: exercise}, allIds: [1]});
const edit = (healthConnectType?: string | null) => ({type: 'EDIT_EXERCISE', exerciseId: 1, nameOfExercise: 'Barbell row', muscles: [], alternativeIds: [], isFocus: false, healthConnectType});

describe('GH-528 Health Connect type on EDIT_EXERCISE', () => {
  // No alternatives: the reducer normalizes an empty list to undefined.
  const base: Exercise = {id: 1, name: 'Barbell row', muscles: [], isFocus: false};

  it('stores the chosen type', () => {
    expect(exerciseReducer(state(base), edit('DUMBBELL_ROW')).byId[1]).toEqual({...base, healthConnectType: 'DUMBBELL_ROW'});
  });

  it('keeps the chosen type when a caller does not pass one', () => {
    expect(exerciseReducer(state({...base, healthConnectType: 'DUMBBELL_ROW'}), edit(undefined)).byId[1]).toEqual({...base, healthConnectType: 'DUMBBELL_ROW'});
  });

  it('removes the type again for "automatic" (null)', () => {
    expect(exerciseReducer(state({...base, healthConnectType: 'DUMBBELL_ROW'}), edit(null)).byId[1]).toEqual(base);
  });
});
