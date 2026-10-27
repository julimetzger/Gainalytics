import React from 'react';
import {act, fireEvent, render, within} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import {MD3DarkTheme, PaperProvider} from 'react-native-paper';
import rootReducer, {GlobalState} from '../../../../app/redux/rootReducer';
import {Muscles} from '../../../../app/models/Muscles';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import TrainingsOverview from '../../../../app/components/Training/analyse/TrainingsOverview';
import TrainingPlanOverview from '../../../../app/components/Training/analyse/TrainingPlanOverview';
import MicroOverview from '../../../../app/components/Training/analyse/MicroOverview';
import MicroPlanOverview from '../../../../app/components/Training/analyse/MicroPlanOverview';

// GH-526 runs against the real store and the real Paper: the point of the rework is
// that the chips, the comparison line, the KPI cards, the muscle map and the Muscle
// Overview all read the same two workout lists — mocks would hide exactly that.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const mockVlInsights = jest.fn((..._args: unknown[]) => [] as unknown[]);
jest.mock('../../../../app/components/Training/useVelocityLossInsights', () => ({
  useVelocityLossInsights: (...args: unknown[]) => mockVlInsights(...args),
}));
jest.mock('../../../../app/components/Training/VelocityLossInsightCard', () => {
  const {Text} = require('react-native');
  return ({exerciseName}: {exerciseName: string}) => <Text testID="vl-insight-card">{exerciseName}</Text>;
});
jest.mock('../../../../app/components/Training/CoachInsightCard', () => () => null);

const set = (reps: number, weight: number) => ({reps, weight, rir: 2});
const sets = (n: number, reps: number, weight: number) => Array.from({length: n}, () => set(reps, weight));

const bench = {id: 1, name: 'Bench', muscles: [{muscle: Muscles.CHEST, percent: 100}, {muscle: Muscles.TRICEPS, percent: 50}]};
const squat = {id: 2, name: 'Squat', muscles: [{muscle: Muscles.QUADS, percent: 100}, {muscle: Muscles.GLUTES, percent: 50}]};
const row = {id: 3, name: 'Row', muscles: [{muscle: Muscles.BACK, percent: 100}, {muscle: Muscles.BICEPS, percent: 50}]};

/**
 * Plan 1, one meso, position 1 = "Push squat", position 2 = "Pull".
 * Micro 1: 100 Push squat FINISHED (plan bench 4 / done bench 4, Mon 06/10 18:00–19:17)
 *          101 Pull FINISHED (plan row 3 / done row 3)
 * Micro 2: 200 Push squat FINISHED (plan bench 3 + squat 2 / done bench 4, Mon 13/10 18:02–19:25)
 *          201 Pull PLANNED (plan row 3)
 */
const baseState = (): GlobalState =>
  ({
    exercises: {byId: {1: bench, 2: squat, 3: row}, allIds: [1, 2, 3]},
    workouts: {
      byId: {
        400: {id: 400, exerciseId: 1, sets: sets(4, 5, 100)},
        401: {id: 401, exerciseId: 3, sets: sets(3, 8, 60)},
        410: {id: 410, exerciseId: 1, sets: sets(4, 5, 100)},
        411: {id: 411, exerciseId: 3, sets: sets(3, 8, 60)},
        500: {id: 500, exerciseId: 1, sets: sets(3, 5, 100)},
        502: {id: 502, exerciseId: 2, sets: sets(2, 5, 150)},
        501: {id: 501, exerciseId: 3, sets: sets(3, 8, 60)},
        510: {id: 510, exerciseId: 1, sets: sets(4, 5, 100)},
      },
      allIds: [400, 401, 410, 411, 500, 501, 502, 510],
      byExerciseId: {},
      plannedWorkouts: [],
    },
    trainings: {
      byId: {
        100: {
          id: 100,
          state: TrainingsState.FINISHED,
          exercises: [1],
          plannedWorkouts: {1: 400},
          doneWorkoutIds: {1: 410},
          start: new Date(2026, 9, 6, 18, 0),
          end: new Date(2026, 9, 6, 19, 17),
        },
        101: {id: 101, state: TrainingsState.FINISHED, exercises: [3], plannedWorkouts: {3: 401}, doneWorkoutIds: {3: 411}, start: new Date(2026, 9, 8, 18, 0), end: new Date(2026, 9, 8, 19, 0)},
        200: {
          id: 200,
          state: TrainingsState.FINISHED,
          exercises: [1, 2],
          plannedWorkouts: {1: 500, 2: 502},
          doneWorkoutIds: {1: 510},
          start: new Date(2026, 9, 13, 18, 2),
          end: new Date(2026, 9, 13, 19, 25),
        },
        201: {id: 201, state: TrainingsState.PLANNED, exercises: [3], plannedWorkouts: {3: 501}, doneWorkoutIds: {}},
      },
      allIds: [100, 101, 200, 201],
    },
    trainingsPlan: {
      byId: {1: {id: 1, name: 'Push pull', trainings: {'1,1': 100, '1,2': 101, '2,1': 200, '2,2': 201}, trainingNames: {1: 'Push squat', 2: 'Pull'}, mesos: [{id: 1, name: 'Meso 1', order: 0, startMicro: 1}]}},
      allIds: [1],
    },
    videoAnalyses: {byId: {}, allIds: []},
    settings: {mode: 'dark'},
    effects: {},
    aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
  }) as unknown as GlobalState;

const renderWith = (ui: React.ReactElement, state: GlobalState = baseState()) => {
  const store = createStore((s: GlobalState | undefined, a: AnyAction) => rootReducer(s ?? state, a), state);
  const utils = render(
    <Provider store={store}>
      <PaperProvider theme={MD3DarkTheme}>{ui}</PaperProvider>
    </Provider>,
  );
  return {store, ...utils};
};

const plan = (state: GlobalState = baseState()) => state.trainingsPlan.byId[1] as any;
const trainingOf = (id: number, state: GlobalState = baseState()) => state.trainings.byId[id] as any;
const text = (node: any) => {
  const children = node.props.children;
  return Array.isArray(children) ? children.join('') : String(children);
};

describe('GH-526 — training analysis, Train position', () => {
  const renderTrain = (state: GlobalState = baseState(), id = 200, micro = 2) =>
    renderWith(<TrainingsOverview training={trainingOf(id, state)} trainingsPlan={plan(state)} currentMicro={micro} trainingInMicro={1} />, state);

  it('offers vs Plan · vs last <Training> · vs Micro as chips and defaults to vs Plan', () => {
    const {getByTestId, getByText} = renderTrain();

    expect(getByText('vs Plan')).toBeTruthy();
    expect(getByText('vs last Push squat')).toBeTruthy();
    expect(getByText('vs Micro')).toBeTruthy();
    expect(getByTestId('analysis-compare-this_training_plan').props.accessibilityState.selected).toBe(true);
    expect(text(getByTestId('analysis-comparison-line'))).toBe('Done vs plan of this training');
  });

  it('shows done / plan in the KPI cards, without a duration (no planned duration exists)', () => {
    const {getByTestId, queryByTestId} = renderTrain();

    expect(text(getByTestId('trainings-overview-sets-value'))).toBe('4');
    expect(text(getByTestId('trainings-overview-sets-reference'))).toBe(' / 5');
    expect(text(getByTestId('trainings-overview-sets-delta'))).toBe('−1 (−20%)');
    expect(queryByTestId('trainings-overview-duration')).toBeNull();
  });

  it('names the micro and the date of the last matching training and adds the duration KPI', () => {
    const {getByTestId, store} = renderTrain();

    fireEvent.press(getByTestId('analysis-compare-last_training_done'));

    expect(text(getByTestId('analysis-comparison-line'))).toBe('Done vs Micro 1 · Push squat (done) · Tue 06/10/2026');
    expect(text(getByTestId('trainings-overview-duration-value'))).toBe('1h 23min');
    expect(text(getByTestId('trainings-overview-duration-reference'))).toBe(' / 1h 17min');
    expect(text(getByTestId('trainings-overview-duration-delta'))).toBe('+6min');
    expect(text(getByTestId('trainings-overview-sets-delta'))).toBe('±0 (±0%)');
    // the choice is persisted for the Train position
    expect(store.getState().settings.muscleMapCompareSelectionAnalyse).toBe('last_training_done');
  });

  it('reads vs Micro as a share of the micro plan in the KPI cards and the muscle map', () => {
    const {getByTestId, getByText} = renderTrain();

    fireEvent.press(getByTestId('analysis-compare-current_total_plan'));

    expect(text(getByTestId('analysis-comparison-line'))).toBe('Done vs plan of all trainings in Micro 2');
    // done 4 sets of a micro plan of 3 + 2 + 3 = 8 sets
    expect(text(getByTestId('trainings-overview-sets-delta'))).toBe('50% of Micro 2 plan');
    expect(getByText('Share')).toBeTruthy();
    fireEvent.press(getByTestId('analysis-muscle-map-view-diff'));
    // Chest: done 4 of a planned 3 (bench only) → 133 %, readout is ONLY the percentage
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('133%');
  });

  it('uses the same reference in the muscle map: Total shows value/reference, Diff only the delta', () => {
    const {getByTestId} = renderTrain();

    // Total: done 4 chest sets against 3 planned
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('4/3');
    // Quads were planned (squat) but not trained — kept as the biggest shortfall
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.QUADS}-readout`))).toBe('0/2');

    fireEvent.press(getByTestId('analysis-muscle-map-view-diff'));
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('+1');
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.QUADS}-readout`))).toBe('−2');
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.TRICEPS}-readout`))).toBe('+0.5');
  });

  it('tints a value bar below 60 % of its reference and splits Sets bars into one segment per set', () => {
    const {getByTestId, queryByTestId} = renderTrain();
    const row = (muscle: string) => `analysis-muscle-map-row-${muscle}`;

    // Chest 4/3 is above the reference, Quads 0/2 and Glutes 0/1 are far below 60 %
    expect(getByTestId(`${row(Muscles.CHEST)}-value-bar`)).toBeTruthy();
    expect(getByTestId(`${row(Muscles.QUADS)}-value-bar-under`).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({backgroundColor: MD3DarkTheme.colors.tertiary})]),
    );
    expect(getByTestId(`${row(Muscles.GLUTES)}-value-bar-under`)).toBeTruthy();
    expect(queryByTestId(`${row(Muscles.CHEST)}-value-bar-under`)).toBeNull();
    // 4 chest sets → 3 gaps between the segments
    expect(getByTestId(`${row(Muscles.CHEST)}-set-segments`).props.children).toHaveLength(3);

    fireEvent.press(getByTestId('analysis-muscle-map-metric-volume'));
    expect(queryByTestId(`${row(Muscles.CHEST)}-set-segments`)).toBeNull();
    expect(getByTestId(`${row(Muscles.QUADS)}-value-bar-under`)).toBeTruthy();
  });

  it('names an unnamed training by its one-based position', () => {
    const state = baseState();
    (state.trainingsPlan.byId[1] as any).trainingNames = {};
    const {getByTestId, getByText} = renderTrain(state);

    expect(getByText('vs last Training 1')).toBeTruthy();
    fireEvent.press(getByTestId('analysis-compare-last_training_done'));
    expect(text(getByTestId('analysis-comparison-line'))).toBe('Done vs Micro 1 · Training 1 (done) · Tue 06/10/2026');
  });

  it('expands a tapped muscle into Plan M−1, Plan M, Done M−1, Done M', () => {
    const {getByTestId, queryByTestId} = renderTrain();
    const id = `analysis-muscle-map-row-${Muscles.CHEST}`;

    expect(queryByTestId(`${id}-detail`)).toBeNull();
    fireEvent.press(getByTestId(id));

    const detail = within(getByTestId(`${id}-detail`));
    expect(detail.getByText('Plan M1')).toBeTruthy();
    expect(detail.getByText('Done M2')).toBeTruthy();
    expect(text(getByTestId(`${id}-detail-0`))).toBe('4');
    expect(text(getByTestId(`${id}-detail-1`))).toBe('3');
    expect(text(getByTestId(`${id}-detail-2`))).toBe('4');
    expect(text(getByTestId(`${id}-detail-3`))).toBe('4');
  });

  it('labels the Muscle Overview with the reference of the selected chip', () => {
    const {getByTestId, getAllByText} = renderTrain();
    expect(getAllByText('Δ vs Plan').length).toBeGreaterThan(0);

    fireEvent.press(getByTestId('analysis-compare-current_total_plan'));
    expect(getAllByText('Share of Micro 2 plan').length).toBeGreaterThan(0);
  });

  it('disables the last-training chip for the first training of the plan and shows its own values', () => {
    const state = baseState();
    const {getByTestId} = renderTrain(state, 100, 1);

    expect(getByTestId('analysis-compare-last_training_done').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('analysis-compare-this_training_plan').props.accessibilityState.selected).toBe(true);
  });

  it('falls back to "no reference" when nothing is selectable', () => {
    const state = baseState();
    (state.trainings.byId[100] as any).plannedWorkouts = {};
    (state.trainings.byId[101] as any).plannedWorkouts = {};
    const {getByTestId} = renderTrain(state, 100, 1);

    expect(text(getByTestId('analysis-comparison-line'))).toBe('Done of this training · no reference available');
    expect(text(getByTestId(`analysis-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('4');
  });

  it('shows "Duration (live)" and ticks it up while the training runs', () => {
    jest.useFakeTimers();
    try {
      const state = baseState();
      (state.trainings.byId[200] as any).state = TrainingsState.STARTED;
      (state.trainings.byId[200] as any).end = undefined;
      (state.trainings.byId[200] as any).start = new Date(Date.now() - 10 * 60000);
      const {getByTestId, getByText} = renderTrain(state);
      fireEvent.press(getByTestId('analysis-compare-last_training_done'));

      expect(getByText('Duration (live)')).toBeTruthy();
      expect(text(getByTestId('trainings-overview-duration-value'))).toBe('10min');
      act(() => {
        jest.advanceTimersByTime(60000);
      });
      expect(text(getByTestId('trainings-overview-duration-value'))).toBe('11min');
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders one VelocityLossInsightCard per insight', () => {
    mockVlInsights.mockReturnValueOnce([{exerciseId: 1, exerciseName: 'Bench', microHistory: []}]).mockReturnValue([{exerciseId: 1, exerciseName: 'Bench', microHistory: []}]);
    const {getAllByTestId} = renderTrain();
    expect(getAllByTestId('vl-insight-card')).toHaveLength(1);
    mockVlInsights.mockReturnValue([]);
  });
});

describe('GH-526 — training analysis, Plan position', () => {
  const renderPlan = (state: GlobalState = baseState(), id: number | null = 200, micro = 2) =>
    renderWith(<TrainingPlanOverview training={id === null ? undefined : trainingOf(id, state)} trainingsPlan={plan(state)} micro={micro} trainingInMicro={1} />, state);

  it('offers only vs last <Training> and vs Micro, defaulting to the last matching plan', () => {
    const {getByTestId, queryByTestId} = renderPlan();

    expect(queryByTestId('analysis-compare-this_training_plan')).toBeNull();
    expect(queryByTestId('analysis-compare-last_training_done')).toBeNull();
    expect(getByTestId('analysis-compare-last_training_plan').props.accessibilityState.selected).toBe(true);
    expect(text(getByTestId('analysis-comparison-line'))).toBe('Plan vs Micro 1 · Push squat (plan)');
    // planned 5 sets vs 4 planned last time
    expect(text(getByTestId('training-plan-overview-sets-value'))).toBe('5');
    expect(text(getByTestId('training-plan-overview-sets-delta'))).toBe('+1 (+25%)');
  });

  it('shows the share of the micro plan for vs Micro and persists the choice for the Plan position', () => {
    const {getByTestId, store} = renderPlan();

    fireEvent.press(getByTestId('analysis-compare-current_total_plan'));

    expect(text(getByTestId('analysis-comparison-line'))).toBe('Plan vs plan of all trainings in Micro 2');
    expect(text(getByTestId('training-plan-overview-sets-delta'))).toBe('63% of Micro 2 plan');
    expect(store.getState().settings.muscleMapCompareSelectionPlan).toBe('current_total_plan');
  });

  it('keeps the empty state for a training without planned sets', () => {
    const {getByTestId, queryByTestId} = renderPlan(baseState(), null);
    expect(getByTestId('training-plan-overview-empty')).toBeTruthy();
    expect(queryByTestId('analysis-muscle-map')).toBeNull();
  });
});

describe('GH-526 — micro Overview, Total tab', () => {
  const renderTotal = (micro = 2) => renderWith(<MicroOverview trainingsPlan={plan()} micro={micro} />);

  it('compares against the previous micro by default and names both sides', () => {
    const {getByTestId} = renderTotal();

    expect(getByTestId('micro-compare-previous').props.accessibilityState.selected).toBe(true);
    expect(text(getByTestId('micro-comparison-line'))).toBe('Micro 2 (done) vs Micro 1 (done)');
    // done 4 sets vs 4 + 3 done in micro 1
    expect(text(getByTestId('micro-total-sets-delta'))).toBe('−3 (−43%)');
    expect(text(getByTestId('micro-total-duration-value'))).toBe('1h 23min');
  });

  it('switches to done vs this micro\'s plan with a Trainings KPI', () => {
    const {getByTestId, queryByTestId} = renderTotal();

    fireEvent.press(getByTestId('micro-compare-plan'));

    expect(text(getByTestId('micro-comparison-line'))).toBe('Micro 2 done vs Micro 2 plan');
    expect(text(getByTestId('micro-total-trainings-value'))).toBe('1');
    expect(text(getByTestId('micro-total-trainings-reference'))).toBe(' / 2');
    expect(text(getByTestId('micro-total-trainings-delta'))).toBe('1 open');
    expect(queryByTestId('micro-total-duration')).toBeNull();
    expect(text(getByTestId(`micro-muscle-map-row-${Muscles.BACK}-readout`))).toBe('0/3');
  });

  // GH-644: the denominator is every training of the plan (Home's counter), not only the planned ones
  it('counts trainings without planned sets as open in vs Plan', () => {
    const state = baseState();
    const storedPlan = state.trainingsPlan.byId[1];
    storedPlan.trainingNames = {1: 'Push squat', 2: 'Pull', 3: 'Legs', 4: 'Upper'};
    storedPlan.trainings = {...storedPlan.trainings, '2,3': 202};
    state.trainings.byId[202] = {id: 202, state: TrainingsState.PLANNED, exercises: [], plannedWorkouts: {}, doneWorkoutIds: {}} satisfies Training;
    // the prop is the plan of the navigation params; the counter reads the stored plan
    const {getByTestId} = renderWith(<MicroOverview trainingsPlan={plan()} micro={2} />, state);

    fireEvent.press(getByTestId('micro-compare-plan'));

    expect(text(getByTestId('micro-total-trainings-value'))).toBe('1');
    expect(text(getByTestId('micro-total-trainings-reference'))).toBe(' / 4');
    expect(text(getByTestId('micro-total-trainings-delta'))).toBe('3 open · 2 not planned');
    // neutral, not the error colour of a decrease
    expect(StyleSheet.flatten(getByTestId('micro-total-trainings-delta').props.style).color).toBe(MD3DarkTheme.colors.onSurfaceVariant);
    // Sets keep comparing against the actually planned sets: done 4 vs 3 + 2 + 3 planned
    expect(text(getByTestId('micro-total-sets-delta'))).toBe('−4 (−50%)');
  });

  it('has a muscle map that follows the selected chip', () => {
    const {getByTestId} = renderTotal();

    // vs Micro 1: Back 0 now vs 3 rows last micro
    expect(text(getByTestId(`micro-muscle-map-row-${Muscles.BACK}-readout`))).toBe('0/3');
    expect(text(getByTestId(`micro-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('4/4');
    fireEvent.press(getByTestId('micro-compare-plan'));
    expect(text(getByTestId(`micro-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('4/3');
  });

  it('disables vs previous micro in the first micro', () => {
    const {getByTestId} = renderTotal(1);
    expect(getByTestId('micro-compare-previous').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('micro-compare-plan').props.accessibilityState.selected).toBe(true);
  });
});

describe('GH-526 — micro Overview, Plan tab', () => {
  it('compares plan vs previous plan only, without any compare selection', () => {
    const {getByTestId, queryByTestId} = renderWith(<MicroPlanOverview trainingsPlan={plan()} micro={2} />);

    expect(text(getByTestId('micro-plan-comparison-line'))).toBe('Plan M2 vs Plan M1');
    expect(queryByTestId('micro-compare-previous')).toBeNull();
    expect(queryByTestId('micro-plan-muscle-map-view-total')).toBeTruthy();
    // planned 3 + 2 + 3 = 8 vs 4 + 3 = 7
    expect(text(getByTestId('micro-plan-sets-delta'))).toBe('+1 (+14%)');
    expect(text(getByTestId(`micro-plan-muscle-map-row-${Muscles.QUADS}-readout`))).toBe('2/0');
  });

  it('says there is no reference in the first micro and shows the own values only', () => {
    const {getByTestId, queryByTestId} = renderWith(<MicroPlanOverview trainingsPlan={plan()} micro={1} />);

    expect(text(getByTestId('micro-plan-comparison-line'))).toBe('Plan M1');
    expect(getByTestId('micro-plan-no-reference')).toBeTruthy();
    expect(queryByTestId('micro-plan-muscle-map-view-total')).toBeNull();
    expect(text(getByTestId(`micro-plan-muscle-map-row-${Muscles.CHEST}-readout`))).toBe('4');
  });

  it('stays a clean screen for a micro without planned sets', () => {
    const {getByTestId} = renderWith(<MicroPlanOverview trainingsPlan={plan()} micro={9} />);
    expect(getByTestId('micro-plan-overview-empty')).toBeTruthy();
  });
});

describe('GH-526 — micro trainings subscription', () => {
  it('does not re-render a subscriber on a store change that leaves the micro\'s trainings untouched', () => {
    const {useAllTrainingsInMicro} = require('../../../../app/redux/Training/use/useAllTrainingsInMicro');
    let renders = 0;
    const Probe = () => {
      renders += 1;
      useAllTrainingsInMicro(1, 2);
      return null;
    };
    const {store} = renderWith(<Probe />);
    const before = renders;

    act(() => {
      store.dispatch({type: 'GH526_UNRELATED_ACTION'});
      store.dispatch({type: 'SET_LAST_USED_EXERCISE_NOOP'});
    });

    expect(renders).toBe(before);
  });
});
