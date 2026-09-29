import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import AnalyseStaleRangeBanner from '../../../app/components/analyse/AnalyseStaleRangeBanner';
import {Range} from '../../../app/components/picker/date/DateRangePicker';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {Workout} from '../../../app/models/entities/Workout';

// jest.setup.js stubs useSelector globally to () => []; a spec that drives a
// real store has to undo that first.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const LAST_WORKOUT_END = new Date(2026, 1, 28, 19, 30); // 28 Feb 2026

const makeWorkout = (id: number, start: Date, end: Date) => ({id, exerciseId: 1, start, end, sets: [{}]} as unknown as Workout);

const baseState = {
  exercises: {byId: {}, allIds: []},
  workouts: {byId: {}, allIds: [], byExerciseId: {}, plannedWorkouts: []},
  trainingsPlan: {byId: {}, allIds: []},
  trainings: {byId: {}, allIds: []},
  videoAnalyses: {byId: {}, allIds: []},
  settings: {mode: 'dark'},
  effects: {},
  aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
} as unknown as GlobalState;

const stateWithWorkouts = (workouts: Workout[]) =>
  ({
    ...baseState,
    workouts: {
      byId: Object.fromEntries(workouts.map((workout) => [workout.id!, workout])),
      allIds: workouts.map((workout) => workout.id!),
      byExerciseId: {},
      plannedWorkouts: [],
    },
  } as unknown as GlobalState);

const renderBanner = (state: GlobalState, range: Range, onApplyRange = jest.fn()) => {
  const testReducer = (current: GlobalState | undefined, action: AnyAction): GlobalState => rootReducer(current ?? state, action);
  const store = createStore(testReducer, state);

  return {
    onApplyRange,
    ...render(
      <Provider store={store}>
        <PaperProvider>
          <AnalyseStaleRangeBanner range={range} onApplyRange={onApplyRange} />
        </PaperProvider>
      </Provider>,
    ),
  };
};

/**
 * GH-458 (H5): the baseline data ends on 28/02/2026. Opened months later, every
 * Analyse screen's default range is empty and nothing told the user that data
 * exists — just earlier.
 */
describe('AnalyseStaleRangeBanner (GH-458 H5)', () => {
  const emptyDefaultRange = new Range(new Date(2026, 5, 14), new Date(2026, 8, 20)); // last 3 months, holds nothing
  const populatedRange = new Range(new Date(2025, 11, 1), new Date(2026, 1, 28, 23, 59));

  it('names the last training date when the default range is empty but data exists', () => {
    const {getByTestId} = renderBanner(stateWithWorkouts([makeWorkout(1, LAST_WORKOUT_END, LAST_WORKOUT_END)]), emptyDefaultRange);

    expect(getByTestId('analyse-stale-range-banner-text').props.children).toBe('No trainings in this period. Your last training was on Sat, 28/02/26.');
  });

  it('corrects the range to the last training in one tap', () => {
    const onApplyRange = jest.fn();
    const {getByTestId} = renderBanner(stateWithWorkouts([makeWorkout(1, LAST_WORKOUT_END, LAST_WORKOUT_END)]), emptyDefaultRange, onApplyRange);

    fireEvent.press(getByTestId('analyse-stale-range-banner-action'));

    expect(onApplyRange).toHaveBeenCalledTimes(1);
    const suggestedRange: Range = onApplyRange.mock.calls[0][0];
    expect(suggestedRange.dateIsInRange(LAST_WORKOUT_END)).toBe(true);
  });

  it('stays hidden when the selected range already shows the data', () => {
    const {queryByTestId} = renderBanner(stateWithWorkouts([makeWorkout(1, LAST_WORKOUT_END, LAST_WORKOUT_END)]), populatedRange);

    expect(queryByTestId('analyse-stale-range-banner')).toBeNull();
  });

  /**
   * On a genuinely empty account there is nothing to point at — pretending a
   * range is to blame would be worse than the screens' own empty states.
   */
  it('stays hidden on an empty store', () => {
    const {queryByTestId} = renderBanner(baseState, emptyDefaultRange);

    expect(queryByTestId('analyse-stale-range-banner')).toBeNull();
  });

  it('stays hidden when the range holds workouts even though older ones exist', () => {
    const workouts = [makeWorkout(1, new Date(2025, 0, 5, 10, 0), new Date(2025, 0, 5, 11, 0)), makeWorkout(2, LAST_WORKOUT_END, LAST_WORKOUT_END)];
    const {queryByTestId} = renderBanner(stateWithWorkouts(workouts), populatedRange);

    expect(queryByTestId('analyse-stale-range-banner')).toBeNull();
  });
});
