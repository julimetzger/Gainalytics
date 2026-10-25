import React from 'react';
import {render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import rootReducer from '../../../app/redux/rootReducer';
import MetricsOverviewForWorkouts from '../../../app/components/analyse/MetricsOverviewForWorkouts';
import {Workout} from '../../../app/models/entities/Workout';

// jest.setup.js stubs useSelector globally; this spec drives a real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

// Default exercise 1 (Bench Press) trains Chest 100 %, Triceps 70 %, Shoulders 10 %.
const benchWorkout = {id: 1, exerciseId: 1, sets: [{reps: 5, weight: 100, rir: 1}]} satisfies Partial<Workout>;

const muscleRows = (store: ReturnType<typeof createStore>) => {
  const {getAllByTestId} = render(
    <Provider store={store}>
      <PaperProvider>
        <MetricsOverviewForWorkouts trainingsWorkouts={[benchWorkout as Workout]} showExercises={false} />
      </PaperProvider>
    </Provider>,
  );
  // One cell per muscle and metric slot: `metrics-muscle-<muscle>-<slot>`.
  return getAllByTestId(/^metrics-muscle-.*-0$/).map((cell) => cell.props.testID.replace(/^metrics-muscle-|-0$/g, ''));
};

describe('Muscle Overview follows the overview muscle setting (GH-523)', () => {
  it('lists every trained muscle by default', () => {
    expect(muscleRows(createStore(rootReducer))).toEqual(['Chest', 'Shoulders', 'Triceps']);
  });

  it('leaves out a muscle hidden from the overviews', () => {
    const store = createStore(rootReducer);
    store.dispatch({type: 'SET_MUSCLE_IN_OVERVIEWS', muscle: 'Triceps', visible: false});

    expect(muscleRows(store)).toEqual(['Chest', 'Shoulders']);
  });
});
