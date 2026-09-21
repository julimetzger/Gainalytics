import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import DashboardTab from '../../../app/tabs/Analyse/DashboardTab';
import {buildMetricsDrilldownKey} from '../../../app/tabs/Analyse/Metrics';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {Workout} from '../../../app/models/entities/Workout';
import {Exercise} from '../../../app/models/entities/Exercise';
import {Muscles} from '../../../app/models/Muscles';

jest.mock('react-redux', () => jest.requireActual('react-redux'));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate}),
  useFocusEffect: (cb: () => void) => cb(),
  useIsFocused: () => true,
}));

const LAST_WORKOUT_START = new Date(2026, 1, 28, 18, 0);
const LAST_WORKOUT_END = new Date(2026, 1, 28, 19, 30);

const squat = {id: 1, name: 'Squat', muscles: [{muscle: Muscles.QUADS, percent: 100}]} as unknown as Exercise;

const lastWorkout = {
  id: 1,
  exerciseId: 1,
  start: LAST_WORKOUT_START,
  end: LAST_WORKOUT_END,
  sets: [{reps: 5, weight: 100, rir: 1}],
} as unknown as Workout;

const makeState = (workouts: Workout[]) =>
  ({
    exercises: {byId: {1: squat}, allIds: [1]},
    workouts: {
      byId: Object.fromEntries(workouts.map((workout) => [workout.id!, workout])),
      allIds: workouts.map((workout) => workout.id!),
      byExerciseId: {},
      plannedWorkouts: [],
    },
    trainingsPlan: {byId: {}, allIds: []},
    trainings: {byId: {}, allIds: []},
    videoAnalyses: {byId: {}, allIds: []},
    settings: {mode: 'dark'},
    effects: {},
    aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
  } as unknown as GlobalState);

const renderDashboard = (state: GlobalState) => {
  const testReducer = (current: GlobalState | undefined, action: AnyAction): GlobalState => rootReducer(current ?? state, action);
  const store = createStore(testReducer, state);

  return render(
    <Provider store={store}>
      <PaperProvider>
        <DashboardTab />
      </PaperProvider>
    </Provider>,
  );
};

beforeEach(() => {
  mockNavigate.mockClear();
});

/**
 * GH-458 (H4): "Tap a muscle group for details" was the Dashboard's only
 * drill-down. It navigated to Metrics with no muscle and no range, so the user
 * landed on `0 selected` and a table reset to the current week — empty.
 */
describe('Dashboard muscle drill-down (GH-458 H4)', () => {
  it('hands the tapped muscle to the Metrics Overview', () => {
    const {getByTestId} = renderDashboard(makeState([lastWorkout]));

    fireEvent.press(getByTestId(`muscle-chip-${Muscles.QUADS}`));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [routeName, params] = mockNavigate.mock.calls[0];
    expect(routeName).toBe('Metrics');
    expect(params.muscle).toBe(Muscles.QUADS);
  });

  it('hands over a range that contains the last logged workout, not the empty current week', () => {
    const {getByTestId} = renderDashboard(makeState([lastWorkout]));

    fireEvent.press(getByTestId(`muscle-chip-${Muscles.QUADS}`));

    const [, params] = mockNavigate.mock.calls[0];
    expect(params.rangeStartMs).toBeLessThanOrEqual(LAST_WORKOUT_START.getTime());
    expect(params.rangeEndMs).toBeGreaterThanOrEqual(LAST_WORKOUT_END.getTime());
  });

  /**
   * On an empty store the Dashboard shows the onboarding empty state (H3), so
   * there is no muscle chip to tap — a drill-down into a table that cannot hold
   * anything would just be the old bug in a new place.
   */
  it('offers no drill-down at all on an empty store', () => {
    const {queryByTestId, getByTestId} = renderDashboard(makeState([]));

    expect(queryByTestId(`muscle-chip-${Muscles.QUADS}`)).toBeNull();
    expect(getByTestId('dashboard-empty-store')).toBeTruthy();
  });

  /**
   * The drawer keeps Metrics mounted and both the muscle selection and the
   * RangeSwiper's start value are seeded on mount only — a second drill-down
   * has to remount the content or it silently keeps showing the first muscle.
   */
  it('produces a different remount key for a second drill-down', () => {
    const first = buildMetricsDrilldownKey({muscle: Muscles.QUADS, rangeStartMs: 1, rangeEndMs: 2});
    const second = buildMetricsDrilldownKey({muscle: Muscles.BACK, rangeStartMs: 1, rangeEndMs: 2});
    const sameMuscleOtherRange = buildMetricsDrilldownKey({muscle: Muscles.QUADS, rangeStartMs: 3, rangeEndMs: 4});

    expect(first).not.toBe(second);
    expect(first).not.toBe(sameMuscleOtherRange);
    expect(buildMetricsDrilldownKey(undefined)).toBe('all-default-default');
  });
});
