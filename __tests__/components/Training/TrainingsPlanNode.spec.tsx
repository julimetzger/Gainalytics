import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import TrainingsPlanNode from '../../../app/components/Training/TrainingsPlanNode';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';

// ── mocks ────────────────────────────────────────────────────────────────────

const mockDeleteTraining = jest.fn();
const mockFinishTraining = jest.fn();
const mockStartTraining = jest.fn();

jest.mock('../../../app/redux/Training/use/useTrainingInTrainingsPlan', () => ({
  useTrainingInTrainingsPlan: jest.fn(),
}));
const {useTrainingInTrainingsPlan} = require('../../../app/redux/Training/use/useTrainingInTrainingsPlan');

jest.mock('../../../app/redux/Training/trainingsPlanReducer', () => ({
  getPreviousMicroInMeso: jest.fn(() => null),
}));

jest.mock('../../../app/redux/Training/use/useLastTrainingOfPreviousMeso', () => ({
  useLastTrainingOfPreviousMeso: jest.fn(() => undefined),
}));

jest.mock('../../../app/redux/Exercises/use/useExerciseByIds', () => ({
  // Two exercises so chosenExercises is initialized to exercises[0].id (requires length > 1)
  useExerciseByIds: jest.fn(() => [
    {id: 1, name: 'Squat', alternativeIds: []},
    {id: 2, name: 'Bench', alternativeIds: []},
  ]),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(() => undefined),
}));

jest.mock('../../../app/redux/settings/use/useSettings', () => ({
  useSettings: () => ({toggles: {disableTimer: true, disableToasts: true}}),
}));

jest.mock('../../../app/redux/Training/dispatch/plan/dispatchStartTraining', () => ({
  dispatchStartTraining: () => mockStartTraining,
}));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchModifyExercisesInTraining', () => ({
  dispatchModifyExercisesInTraining: () => jest.fn(),
}));
jest.mock('../../../app/redux/Training/dispatch/execute/dispatchFinishTraining', () => ({
  dispatchFinishTraining: () => mockFinishTraining,
}));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchDeleteTraining', () => ({
  dispatchDeleteTraining: () => mockDeleteTraining,
}));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchReplaceExerciseInTraining', () => ({
  dispatchReplaceExerciseInTraining: () => jest.fn(),
}));

jest.mock('../../../app/components/Training/execute/PauseDoneNotification', () => ({
  PauseDoneNotification: () => [jest.fn(), jest.fn()],
}));
jest.mock('../../../app/components/Training/execute/FinishTrainingNotification', () => ({
  FinishTrainingNotification: () => [jest.fn(), jest.fn()],
}));
jest.mock('react-native-toast-message', () => ({show: jest.fn(), default: {show: jest.fn()}}));

jest.mock('../../../app/components/Training/ExerciseAlternativesDialog', () => 'ExerciseAlternativesDialog');
jest.mock('../../../app/components/Training/execute/ExecuteTraining', () => {
  const {Text} = require('react-native');
  return () => <Text testID="execute-workout">ExecuteWorkout</Text>;
});
jest.mock('../../../app/components/Training/execute/EditTraining', () => {
  const {Text} = require('react-native');
  return () => <Text testID="edit-training">EditTraining</Text>;
});
jest.mock('../../../app/components/picker/elements/TrainingElementPicker', () => 'TrainingElementPicker');
jest.mock('../../../app/components/Training/DraggableExercise', () => 'DraggableExercise');
jest.mock('../../../app/components/Training/analyse/TrainingsOverview', () => {
  const {Text} = require('react-native');
  return () => <Text testID="trainings-overview">TrainingsOverview</Text>;
});
jest.mock('../../../app/tabs/trainings/MicroOverviewTraining', () => {
  const {Text} = require('react-native');
  return () => <Text testID="micro-overview">MicroOverview</Text>;
});
jest.mock('../../../app/components/Training/analyse/TrainingHistory', () => {
  const {Text} = require('react-native');
  return () => <Text testID="training-history">TrainingHistory</Text>;
});
jest.mock('../../../app/components/Training/TrainingsBase', () => 'TrainingsBase');
jest.mock('../../../app/components/Training/plan/PlanTab', () => {
  const {Text, TouchableOpacity, View} = require('react-native');
  // Surfaces the picker wiring so a test can open the picker and observe whether
  // the parent keeps it open (GH-401 H3).
  return ({pickerVisible, onTogglePicker}: any) => (
    <View>
      <Text testID="plan-workout">PlanWorkout</Text>
      <Text testID="plan-workout-picker-visible">{String(pickerVisible)}</Text>
      <TouchableOpacity testID="plan-workout-toggle-picker" onPress={onTogglePicker}>
        <Text>toggle</Text>
      </TouchableOpacity>
    </View>
  );
});
jest.mock('../../../app/components/Training/analyse/MicroPlanOverview', () => {
  const {Text} = require('react-native');
  return ({micro}: any) => <Text testID="micro-plan-overview">{`micro-plan:${micro}`}</Text>;
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  const DialogBase = ({visible, children}: any) => (visible ? <>{children}</> : null);
  DialogBase.Title = ({children}: any) => <Text>{children}</Text>;
  DialogBase.Content = ({children}: any) => <>{children}</>;
  DialogBase.Actions = ({children}: any) => <>{children}</>;

  return {
    Button: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Dialog: DialogBase,
    Portal: ({children}: any) => <>{children}</>,
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    Menu: Object.assign(
      ({visible, children}: any) => (visible ? <View>{children}</View> : null),
      {
        Item: ({title, onPress, testID, disabled}: any) => (
          <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} disabled={!!disabled}>
            <Text>{typeof title === 'string' ? title : null}</Text>
          </TouchableOpacity>
        ),
      },
    ),
    Divider: () => <View />,
    SegmentedButtons: require('../../helpers/paperMocks').SegmentedButtonsMock,
    useTheme: () => ({
      colors: {background: '#fff', onSurfaceVariant: '#888', primary: '#6200ee'},
      fonts: {},
    }),
  };
});

// ── helpers ──────────────────────────────────────────────────────────────────

const PLAN: TrainingsPlan = {
  id: 1,
  name: 'Push pull',
  trainings: {},
  trainingNames: {1: 'Pull'},
} as any;

const mkTraining = (state: string) => ({
  id: 10,
  state,
  exercises: [1, 2],
  doneWorkoutIds: {},
  plannedWorkouts: {},
  start: new Date(Date.now() - 60000).toISOString(),
});

const defaultProps = {
  trainingsPlan: PLAN,
  micro: 1,
  trainingInMicro: 1,
  showDone: false,
  setIgnoreSwipe: jest.fn(),
  overflowVisible: false,
  onCloseOverflow: jest.fn(),
};

// ── tests ────────────────────────────────────────────────────────────────────

describe('TrainingsPlanNode — sub-tab defaults per state', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to Plan tab for PLANNED state', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    // Plan tab is active → PlanWorkout visible
    expect(getByTestId('plan-workout')).toBeTruthy();
  });

  it('defaults to Train tab for STARTED state', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    // Train tab is active → ExecuteWorkout visible
    expect(getByTestId('execute-workout')).toBeTruthy();
    expect(queryByTestId('plan-workout')).toBeNull();
  });

  it('defaults to Analysis tab for FINISHED state', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    expect(getByTestId('trainings-overview')).toBeTruthy();
    expect(queryByTestId('training-history')).toBeNull();
  });
});

describe('TrainingsPlanNode — sub-tab switching', () => {
  beforeEach(() => jest.clearAllMocks());

  it('switches from Plan to Train tab when Train is pressed', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    // starts on Plan tab
    expect(queryByTestId('plan-workout')).toBeTruthy();
    // press Train tab
    fireEvent.press(getByTestId('subtab-train'));
    // Train tab for PLANNED → Start Training button, plan content gone
    expect(queryByTestId('plan-workout')).toBeNull();
    expect(queryByTestId('train-tab-start-button')).toBeTruthy();
  });

  it('switches from Analysis to Train tab for FINISHED state', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    expect(getByTestId('trainings-overview')).toBeTruthy();
    fireEvent.press(getByTestId('subtab-train'));
    expect(getByTestId('training-history')).toBeTruthy();
    expect(queryByTestId('trainings-overview')).toBeNull();
  });

  it('Plan tab always shows PlanWorkout regardless of state', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    // start on Analysis; press Plan
    fireEvent.press(getByTestId('subtab-plan'));
    expect(getByTestId('plan-workout')).toBeTruthy();
  });
});

describe('TrainingsPlanNode — body content per tab/state', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Train tab for PLANNED shows Start Training button', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    fireEvent.press(getByTestId('subtab-train'));
    expect(getByTestId('train-tab-start-button')).toBeTruthy();
  });

  it('Train tab Start button triggers start action for PLANNED', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    fireEvent.press(getByTestId('subtab-train'));
    fireEvent.press(getByTestId('train-tab-start-button'));
    expect(mockStartTraining).toHaveBeenCalled();
  });

  it('Analysis tab for STARTED shows live TrainingsOverview, not the placeholder (GH-367)', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId, queryByText} = render(<TrainingsPlanNode {...defaultProps} />);
    fireEvent.press(getByTestId('subtab-analysis'));
    expect(getByTestId('trainings-overview')).toBeTruthy();
    expect(queryByText('Analysis available after the training is finished')).toBeNull();
  });

  it('showDone=true shows MicroOverviewTraining regardless of tab', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} showDone={true} />);
    expect(getByTestId('micro-overview')).toBeTruthy();
  });
});

describe('TrainingsPlanNode — overflow menu actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('overflow menu is shown when overflowVisible=true', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} overflowVisible={true} />);
    expect(getByTestId('overflow-finish')).toBeTruthy();
  });

  it('delete dialog appears when Delete is pressed via overflow', async () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, getByText} = render(<TrainingsPlanNode {...defaultProps} overflowVisible={true} />);
    fireEvent.press(getByTestId('overflow-discard'));
    await waitFor(() => expect(getByText('Delete Training')).toBeTruthy());
  });
});

// ── GH-401 ───────────────────────────────────────────────────────────────────

describe('TrainingsPlanNode — GH-401 Train tab is the single start/finish control', () => {
  beforeEach(() => jest.clearAllMocks());

  it('honours a requested sub-tab instead of the state default (card → Train tab)', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    // Without the request a PLANNED training would open on the Plan tab.
    expect(queryByTestId('plan-workout')).toBeNull();
    expect(getByTestId('train-tab-start-button')).toBeTruthy();
  });

  it('applies the requested sub-tab once and lets the state default win afterwards', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, queryByTestId, rerender} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    expect(getByTestId('train-tab-start-button')).toBeTruthy();

    // Finishing flips the state; FINISHED defaults to Analysis. If the request
    // re-applied on every state change the user would be yanked back to Train.
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    rerender(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    expect(getByTestId('trainings-overview')).toBeTruthy();
    expect(queryByTestId('training-history')).toBeNull();
  });

  it('keeps a consumed sub-tab request consumed while the pane is inactive (swipe away and back)', () => {
    // RangeSwiper passes `requestedSubTab` only to the pane it considers active,
    // so swiping away drops the prop to undefined and swiping back restores it.
    // The request must not fire a second time on the way back.
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId, queryByTestId, rerender} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    expect(getByTestId('execute-workout')).toBeTruthy();

    // The user moves to the Plan tab by hand.
    fireEvent.press(getByTestId('subtab-plan'));
    expect(getByTestId('plan-workout')).toBeTruthy();

    // Swipe away: this pane goes inactive, so the request disappears...
    rerender(<TrainingsPlanNode {...defaultProps} requestedSubTab={undefined} />);
    // ...and back: the same request is handed to the pane again.
    rerender(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    expect(getByTestId('plan-workout')).toBeTruthy();
    expect(queryByTestId('execute-workout')).toBeNull();
  });

  it('keeps the Analysis pre-selection after finishing when the pane is swiped away and back', () => {
    // The concrete regression: land on Train via the card, finish the training
    // (handleFinish pre-selects Analysis), swipe away and back. The stale
    // "train" request used to drag the user off the analysis they just earned.
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId, queryByTestId, rerender} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    fireEvent.press(getByTestId('train-tab-finish-button'));
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    rerender(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    expect(getByTestId('trainings-overview')).toBeTruthy();

    rerender(<TrainingsPlanNode {...defaultProps} requestedSubTab={undefined} />);
    rerender(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    expect(getByTestId('trainings-overview')).toBeTruthy();
    expect(queryByTestId('training-history')).toBeNull();
  });

  it('still applies a fresh request after the user swipes to a different slot', () => {
    // Consuming a request must be scoped to its slot, otherwise navigating from
    // the card to a *different* training would land on the state default.
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, rerender} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    expect(getByTestId('train-tab-start-button')).toBeTruthy();

    fireEvent.press(getByTestId('subtab-plan'));
    expect(getByTestId('plan-workout')).toBeTruthy();

    rerender(<TrainingsPlanNode {...defaultProps} micro={2} requestedSubTab="train" />);
    expect(getByTestId('train-tab-start-button')).toBeTruthy();
  });

  it('shows the Start Training button for a training whose state was never persisted', () => {
    useTrainingInTrainingsPlan.mockReturnValue({...mkTraining(TrainingsState.PLANNED), state: undefined});
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);
    expect(getByTestId('train-tab-start-button')).toBeTruthy();
  });

  it('replaces the old "Start training to begin" dead end with a way into the Plan tab', () => {
    useTrainingInTrainingsPlan.mockReturnValue(undefined);
    const {getByTestId, queryByText} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    expect(queryByText('Start training to begin')).toBeNull();
    expect(getByTestId('train-tab-no-training-hint')).toBeTruthy();

    fireEvent.press(getByTestId('train-tab-go-to-plan-button'));
    expect(getByTestId('plan-workout')).toBeTruthy();
  });

  it('offers Finish Training on the Train tab of a STARTED training, so ⋮ is never needed', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} />);
    expect(getByTestId('execute-workout')).toBeTruthy();

    fireEvent.press(getByTestId('train-tab-finish-button'));
    expect(mockFinishTraining).toHaveBeenCalledWith(10, 1);
  });

  it('does not offer Finish Training while editing a started training', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} overflowVisible={true} />);
    fireEvent.press(getByTestId('overflow-edit'));
    expect(queryByTestId('train-tab-finish-button')).toBeNull();
  });

  it('keeps the exercise picker open when the first pick creates the training (H3 root cause)', () => {
    // Before the fix the reset effect also depended on training.state. Picking the
    // first exercise creates the training (undefined -> PLANNED), so the effect ran
    // mid-selection and closed the picker. The dropdown is a separate native window,
    // so the user was left staring at its empty shell — a search field over a blank
    // area — and only closing and re-opening the picker brought the list back.
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, rerender} = render(<TrainingsPlanNode {...defaultProps} />);

    fireEvent.press(getByTestId('plan-workout-toggle-picker'));
    expect(getByTestId('plan-workout-picker-visible').props.children).toBe('true');

    // The training's state changes underneath the user; the slot does not.
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    rerender(<TrainingsPlanNode {...defaultProps} />);
    fireEvent.press(getByTestId('subtab-plan'));

    expect(getByTestId('plan-workout-picker-visible').props.children).toBe('true');
  });

  it('still closes the picker when the user swipes to a different training slot', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, rerender} = render(<TrainingsPlanNode {...defaultProps} />);

    fireEvent.press(getByTestId('plan-workout-toggle-picker'));
    expect(getByTestId('plan-workout-picker-visible').props.children).toBe('true');

    rerender(<TrainingsPlanNode {...defaultProps} micro={2} />);

    expect(getByTestId('plan-workout-picker-visible').props.children).toBe('false');
  });

  it('no longer offers Start Training in the overflow menu (AC2: one place only)', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {queryByTestId, getAllByText} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" overflowVisible={true} />);
    expect(queryByTestId('overflow-start')).toBeNull();
    // Exactly one "Start Training" label on screen: the Train tab's button.
    expect(getAllByText('Start Training')).toHaveLength(1);
  });
});

describe('TrainingsPlanNode — GH-401 review 1: a training without exercises cannot be started', () => {
  beforeEach(() => jest.clearAllMocks());

  const emptyTraining = (state: string = TrainingsState.PLANNED) => ({...mkTraining(state), exercises: []});

  it('offers no Start control at all when the training has no exercises', () => {
    useTrainingInTrainingsPlan.mockReturnValue(emptyTraining());
    const {queryByTestId, queryByText} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    expect(queryByTestId('train-tab-start-button')).toBeNull();
    expect(queryByText('Start Training')).toBeNull();
  });

  it('offers Add Exercises instead, which lands the user in the Plan tab', () => {
    useTrainingInTrainingsPlan.mockReturnValue(emptyTraining());
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    fireEvent.press(getByTestId('train-tab-add-exercises-button'));

    expect(getByTestId('plan-workout')).toBeTruthy();
    expect(mockStartTraining).not.toHaveBeenCalled();
  });

  it('says why the session cannot start yet', () => {
    useTrainingInTrainingsPlan.mockReturnValue(emptyTraining());
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    expect(getByTestId('train-tab-start-hint').props.children).toContain('no exercises');
  });

  it('still starts normally as soon as the training has exercises', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    fireEvent.press(getByTestId('train-tab-start-button'));

    expect(mockStartTraining).toHaveBeenCalled();
  });

  it('keeps the empty state out of STARTED even if a caller reaches handleStart directly', () => {
    // The Train tab hides the button, so this covers the guard inside handleStart:
    // an unstarted training whose state was never persisted must behave the same.
    useTrainingInTrainingsPlan.mockReturnValue({...emptyTraining(), state: undefined});
    const {queryByTestId, getByTestId} = render(<TrainingsPlanNode {...defaultProps} requestedSubTab="train" />);

    expect(queryByTestId('train-tab-start-button')).toBeNull();
    fireEvent.press(getByTestId('train-tab-add-exercises-button'));
    expect(mockStartTraining).not.toHaveBeenCalled();
  });
});

// ── GH-417: Plan | Train data toggle inside the analysis view ────────────────

describe('TrainingsPlanNode — GH-417 analysis data toggle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the toggle on the Analysis tab and starts on Train (AC1)', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);

    expect(getByTestId('analysis-data-toggle')).toBeTruthy();
    expect(getByTestId('analysis-data-train').props.accessibilityState).toEqual({checked: true, disabled: false});
    // AC3: Train is the unchanged actual-values view
    expect(getByTestId('trainings-overview')).toBeTruthy();
    expect(queryByTestId('micro-plan-overview')).toBeNull();
  });

  it('shows the planned micro overview in the Plan position (AC2)', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);

    fireEvent.press(getByTestId('analysis-data-plan'));

    expect(getByTestId('micro-plan-overview').props.children).toBe('micro-plan:1');
    expect(queryByTestId('trainings-overview')).toBeNull();
    expect(getByTestId('analysis-data-plan').props.accessibilityState).toEqual({checked: true, disabled: false});
  });

  it('keeps the selection across a sub-tab round trip (AC7)', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, queryByTestId} = render(<TrainingsPlanNode {...defaultProps} />);

    fireEvent.press(getByTestId('analysis-data-plan'));
    expect(getByTestId('micro-plan-overview')).toBeTruthy();

    fireEvent.press(getByTestId('subtab-train'));
    expect(queryByTestId('micro-plan-overview')).toBeNull();

    fireEvent.press(getByTestId('subtab-analysis'));
    expect(getByTestId('micro-plan-overview')).toBeTruthy();
    expect(getByTestId('analysis-data-plan').props.accessibilityState).toEqual({checked: true, disabled: false});
  });

  it('offers the planned values for a training that is only PLANNED, where Train has nothing to show', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.PLANNED));
    const {getByTestId, getByText} = render(<TrainingsPlanNode {...defaultProps} />);

    fireEvent.press(getByTestId('subtab-analysis'));
    expect(getByText('Analysis available after the training is finished')).toBeTruthy();
    // AC4: the total is shown in the Train position even when there is nothing logged yet
    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 0 (done)');

    fireEvent.press(getByTestId('analysis-data-plan'));
    expect(getByTestId('micro-plan-overview')).toBeTruthy();
  });

  it('hands the choice to the owner when the screen controls it, so a micro swipe cannot reset it', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const onAnalysisDataModeChange = jest.fn();
    const controlled = {...defaultProps, analysisDataMode: 'train' as const, onAnalysisDataModeChange};
    const {getByTestId, rerender} = render(<TrainingsPlanNode {...controlled} />);

    fireEvent.press(getByTestId('analysis-data-plan'));
    expect(onAnalysisDataModeChange).toHaveBeenCalledWith('plan');
    // the owner's value still wins until it actually changes
    expect(getByTestId('trainings-overview')).toBeTruthy();

    rerender(<TrainingsPlanNode {...controlled} analysisDataMode="plan" micro={2} />);
    expect(getByTestId('micro-plan-overview').props.children).toBe('micro-plan:2');
  });
});
