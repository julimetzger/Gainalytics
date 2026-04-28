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
jest.mock('../../../app/components/Training/plan/PlanTraining', () => {
  const {Text} = require('react-native');
  return () => <Text testID="plan-workout">PlanWorkout</Text>;
});
jest.mock('../../../app/components/Training/plan/PlanningOverview', () => {
  const {Text} = require('react-native');
  return () => <Text testID="planning-overview">PlanningOverview</Text>;
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
  showPlanned: false,
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

  it('Analysis tab for STARTED shows placeholder text', () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.STARTED));
    const {getByTestId, getByText} = render(<TrainingsPlanNode {...defaultProps} />);
    fireEvent.press(getByTestId('subtab-analysis'));
    expect(getByText('Analysis available after the training is finished')).toBeTruthy();
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

  it('delete dialog appears when Discard is pressed via overflow', async () => {
    useTrainingInTrainingsPlan.mockReturnValue(mkTraining(TrainingsState.FINISHED));
    const {getByTestId, getByText} = render(<TrainingsPlanNode {...defaultProps} overflowVisible={true} />);
    fireEvent.press(getByTestId('overflow-discard'));
    await waitFor(() => expect(getByText('Delete Training')).toBeTruthy());
  });
});
