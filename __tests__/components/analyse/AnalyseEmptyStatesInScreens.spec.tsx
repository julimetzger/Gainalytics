import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import DashboardTab from '../../../app/tabs/Analyse/DashboardTab';
import MetricsNode from '../../../app/components/analyse/MetricsNode';
import MetricsActiveFilterLabel from '../../../app/components/analyse/MetricsActiveFilterLabel';
import {Range} from '../../../app/components/picker/date/DateRangePicker';
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

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const ReactLocal = require('react');
  const {Text} = require('react-native');
  const actual = jest.requireActual('../../../app/components/picker/date/DateRangePicker');

  return {
    __esModule: true,
    default: ({range}: {range: {startDate: Date; endDate: Date}}) => <Text testID="mock-range-picker">{`${range.startDate.toISOString()}|${range.endDate.toISOString()}`}</Text>,
    Range: actual.Range,
  };
});

const squat = {id: 1, name: 'Squat', muscles: [{muscle: Muscles.QUADS, percent: 100}]} as unknown as Exercise;

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

const renderWithStore = (state: GlobalState, node: React.ReactElement) => {
  const testReducer = (current: GlobalState | undefined, action: AnyAction): GlobalState => rootReducer(current ?? state, action);
  const store = createStore(testReducer, state);

  return render(
    <Provider store={store}>
      <PaperProvider>{node}</PaperProvider>
    </Provider>,
  );
};

beforeEach(() => mockNavigate.mockClear());

/**
 * GH-458 (H3): the audit found three empty states that said nothing — the
 * chart's blank box, the Metrics Overview's bare table headers, and a Dashboard
 * that looked identical for a brand-new account and a returning user with
 * 2.3 years of history.
 */
describe('Dashboard on an empty store (GH-458 H3)', () => {
  it('names the cause and offers two ways in, instead of showing 0 / 0.0t / 0min', () => {
    const {getByTestId, queryByTestId} = renderWithStore(makeState([]), <DashboardTab />);

    expect(getByTestId('dashboard-empty-store')).toBeTruthy();
    expect(getByTestId('dashboard-empty-store-description').props.children).toContain('Nothing has been logged on this device');
    expect(getByTestId('dashboard-empty-goto-settings')).toBeTruthy();
    expect(getByTestId('dashboard-empty-goto-training')).toBeTruthy();
    // The weekly KPI card is what used to be indistinguishable from a full account.
    expect(queryByTestId('weekly-summary-card')).toBeNull();
  });

  it('routes the user somewhere they can act', () => {
    const {getByTestId} = renderWithStore(makeState([]), <DashboardTab />);

    fireEvent.press(getByTestId('dashboard-empty-goto-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  it('shows the normal dashboard as soon as anything has been logged', () => {
    const workout = {id: 1, exerciseId: 1, start: new Date(2026, 1, 28, 18, 0), end: new Date(2026, 1, 28, 19, 0), sets: []} as unknown as Workout;
    const {getByTestId, queryByTestId} = renderWithStore(makeState([workout]), <DashboardTab />);

    expect(queryByTestId('dashboard-empty-store')).toBeNull();
    expect(getByTestId('weekly-summary-card')).toBeTruthy();
  });
});

describe('Metrics Overview on an empty period (GH-458 H3/H4)', () => {
  const emptyRange = new Range(new Date(2026, 5, 14), new Date(2026, 8, 20));

  const renderNode = (state: GlobalState, muscle: Muscles[] = []) =>
    renderWithStore(state, <MetricsNode range={emptyRange} setRange={jest.fn()} muscle={muscle} exercise={[]} />);

  it('replaces the bare table headers with a named cause and an action', () => {
    const {getByTestId} = renderNode(makeState([]));

    expect(getByTestId('metrics-empty-state')).toBeTruthy();
    expect(getByTestId('metrics-empty-state-description').props.children).toContain('logged no sets between');
    expect(getByTestId('metrics-empty-extend-range')).toBeTruthy();
  });

  /**
   * The label lives next to the picker rather than inside the RangeSwiper pane:
   * content in that pane is not exposed to the Android accessibility tree, so a
   * label placed there is invisible to a screen reader and to an e2e assertion.
   */
  it('spells out the active filter, so a drill-down is visible as such', () => {
    const {getByTestId} = renderWithStore(makeState([]), <MetricsActiveFilterLabel muscle={[Muscles.QUADS]} exercise={[]} />);

    expect(getByTestId('metrics-active-filter').props.children).toBe('Showing: Quads');
  });

  it('says "all exercises" when nothing is filtered', () => {
    const {getByTestId} = renderWithStore(makeState([]), <MetricsActiveFilterLabel muscle={[]} exercise={[]} />);

    expect(getByTestId('metrics-active-filter').props.children).toBe('Showing: all exercises');
  });
});
