/**
 * PR #628: the exercise filter of the "link video to a set" modal moved to the
 * react-native-paper-dropdown 2.x API. Selecting an exercise must filter the workouts and
 * "All Exercises" must reset the filter, exactly as with 1.x.
 */
import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {PaperProvider} from 'react-native-paper';
import rootReducer from '../../../app/redux/rootReducer';
import SetSelectionModal from '../../../app/components/video/SetSelectionModal';

// jest.setup.js stubs useSelector globally to return [] — this suite drives a real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const SQUAT_ID = 2;
const BENCH_ID = 3;
const SQUAT_WORKOUT_ID = 501;
const BENCH_WORKOUT_ID = 502;

const makeStore = () => {
  const initialState = configureStore({reducer: rootReducer}).getState();
  return configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...initialState,
      exercises: {
        ...initialState.exercises,
        byId: {
          [SQUAT_ID]: {id: SQUAT_ID, name: 'Squat', muscles: []},
          [BENCH_ID]: {id: BENCH_ID, name: 'Bench', muscles: []},
        },
        allIds: [SQUAT_ID, BENCH_ID],
      },
      workouts: {
        ...initialState.workouts,
        byId: {
          [SQUAT_WORKOUT_ID]: {id: SQUAT_WORKOUT_ID, exerciseId: SQUAT_ID, sets: [{index: 1, reps: 3, rir: 1, weight: 200}]},
          [BENCH_WORKOUT_ID]: {id: BENCH_WORKOUT_ID, exerciseId: BENCH_ID, sets: [{index: 1, reps: 5, rir: 2, weight: 100}]},
        },
        allIds: [SQUAT_WORKOUT_ID, BENCH_WORKOUT_ID],
      },
    },
  });
};

const renderModal = () =>
  render(
    <Provider store={makeStore()}>
      <PaperProvider>
        <SetSelectionModal visible analysisId={1} onDismiss={jest.fn()} />
      </PaperProvider>
    </Provider>,
  );

const visibleSetIds = () =>
  [SQUAT_WORKOUT_ID, BENCH_WORKOUT_ID].filter(id => screen.queryByTestId(`set-selection-set-${id}-1`) !== null);

const pickFilterOption = async (value: string) => {
  fireEvent.press(screen.getByTestId('set-selection-exercise-filter'));
  const option = await waitFor(() => screen.getByTestId(`set-selection-exercise-filter-menu-${value}`));
  fireEvent.press(option);
};

describe('SetSelectionModal – exercise filter', () => {
  it('starts on "All Exercises" and shows every workout', () => {
    renderModal();

    expect(screen.getByDisplayValue('All Exercises')).toBeTruthy();
    expect(visibleSetIds()).toEqual([SQUAT_WORKOUT_ID, BENCH_WORKOUT_ID]);
  });

  it('filters by the selected exercise and resets via "All Exercises"', async () => {
    renderModal();

    await pickFilterOption(String(SQUAT_ID));
    await waitFor(() => expect(visibleSetIds()).toEqual([SQUAT_WORKOUT_ID]));
    expect(screen.getByDisplayValue('Squat')).toBeTruthy();

    await pickFilterOption('all');
    await waitFor(() => expect(visibleSetIds()).toEqual([SQUAT_WORKOUT_ID, BENCH_WORKOUT_ID]));
    expect(screen.getByDisplayValue('All Exercises')).toBeTruthy();
  });
});
