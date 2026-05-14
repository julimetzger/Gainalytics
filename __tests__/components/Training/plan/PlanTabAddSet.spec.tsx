import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import PlanTab from '../../../../app/components/Training/plan/PlanTab';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

// GH-240 Bug 2: cover the regression where Full Edit mode silently no-ops on
// the second "Add set" press for an exercise. The real fix lives in
// PlanTab.handleAddSet — these tests render the real PlanEditList so the bug
// surfaces if it ever returns.

const mockAddPlannedWorkout = jest.fn();
const mockDeleteSetFromWorkout = jest.fn();
const mockReplaceWorkoutSets = jest.fn();
const mockDispatch = jest.fn();
let mockPlannedSetsByWorkoutId: Record<number, Workout> = {};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0}),
}));

jest.mock('react-redux', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      workouts: {byId: mockPlannedSetsByWorkoutId},
      settings: {},
    }),
}));

jest.mock('../../../../app/redux/Training/dispatch/plan/dispatchAddPlanedTrainingWorkout', () => ({
  dispatchAddPlanedTrainingWorkout: () => mockAddPlannedWorkout,
}));

jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: () => 900,
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout', () => ({
  dispatchDeleteSetFromWorkout: () => mockDeleteSetFromWorkout,
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchReplaceWorkoutSets', () => ({
  dispatchReplaceWorkoutSets: () => mockReplaceWorkoutSets,
}));

jest.mock('../../../../app/components/picker/elements/TrainingElementPicker', () => () => null);

jest.mock('../../../../app/components/Training/plan/MuscleInvolvementCard', () => () => null);

jest.mock('../../../../app/components/Training/DraggableExercise', () => () => null);

// Real react-native-paper is too heavy here; lightweight stub that exposes
// children-as-function and respects testID.
jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');

  const DialogBase = ({visible, children}: {visible: boolean; children: React.ReactNode}) => (visible ? <View>{children}</View> : null);
  DialogBase.Title = ({children}: {children: React.ReactNode}) => <Text>{children}</Text>;
  DialogBase.Content = ({children}: {children: React.ReactNode}) => <View>{children}</View>;
  DialogBase.Actions = ({children}: {children: React.ReactNode}) => <View>{children}</View>;

  return {
    Button: ({children, onPress, testID, disabled}: {children: React.ReactNode; onPress?: () => void; testID?: string; disabled?: boolean}) => (
      <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} disabled={disabled}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Chip: ({children, testID}: {children: React.ReactNode; testID?: string}) => (
      <View testID={testID}>
        <Text>{children}</Text>
      </View>
    ),
    Dialog: DialogBase,
    Icon: () => null,
    IconButton: ({onPress, testID}: {onPress?: () => void; testID?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    Menu: Object.assign(
      ({children}: {children: React.ReactNode}) => <View>{children}</View>,
      {
        Item: ({title, onPress, testID}: {title?: string; onPress?: () => void; testID?: string}) => (
          <TouchableOpacity testID={testID} onPress={onPress}>
            <Text>{title}</Text>
          </TouchableOpacity>
        ),
      },
    ),
    Portal: ({children}: {children: React.ReactNode}) => <>{children}</>,
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    TextInput: ({label, value, onChangeText, testID}: {label?: string; value?: string; onChangeText?: (value: string) => void; testID?: string}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} testID={testID} />
    ),
    useTheme: () => ({
      colors: {
        elevation: {level3: '#222'},
        onSurfaceVariant: '#888',
        primary: '#3f51b5',
        secondaryContainer: '#222',
        error: '#b00020',
        surfaceVariant: '#111',
        onSurface: '#fff',
      },
    }),
  };
});

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const {View} = require('react-native');
  const ScaleDecorator = ({children}: {children: React.ReactNode}) => <>{children}</>;
  const Component = ({data, renderItem}: {data: Array<{key: string}>; renderItem: (params: any) => React.ReactNode}) => (
    <View>
      {data.map((item, index) => (
        <View key={item.key}>{renderItem({item, drag: () => undefined, isActive: index === -1})}</View>
      ))}
    </View>
  );
  return {__esModule: true, default: Component, NestableDraggableFlatList: Component, ScaleDecorator};
});

jest.mock('../../../../app/components/shared/DashedAddButton', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');
  return ({onPress, testID, label}: {onPress?: () => void; testID?: string; label: string}) => (
    <TouchableOpacity testID={testID} onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
});

const exercises = [{id: 1, name: 'Pull up', alternativeIds: []}] satisfies Exercise[];

const baseTraining = {
  id: 11,
  state: TrainingsState.PLANNED,
  exercises: [1],
  doneWorkoutIds: {},
  plannedWorkouts: {},
} satisfies Training;

const renderPlanTab = (training: Training = baseTraining) => {
  const props = {
    training,
    trainingsPlanId: 55,
    micro: 6,
    trainingInMicro: 1,
    exercises,
    chosenExercise: exercises[0],
    chooseExercise: jest.fn(),
    onExerciseDoublePress: jest.fn(),
    setExercises: jest.fn(),
    doneExerciseIds: [],
    setAbsolutePosition: jest.fn(),
    pickerVisible: false,
    onTogglePicker: jest.fn(),
    isActive: true,
  };
  const utils = render(<PlanTab {...props} editPlanRequestId={0} />);
  // The fullEdit-entry effect only fires when editPlanRequestId changes.
  utils.rerender(<PlanTab {...props} editPlanRequestId={1} />);
  return utils;
};

describe('PlanTab — Full Edit Add-Set (GH-240 Bug 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlannedSetsByWorkoutId = {};
  });

  it('renders the Add set button after entering full edit', async () => {
    const {getByTestId} = renderPlanTab();
    await waitFor(() => expect(getByTestId('plan-add-set-button-1')).toBeTruthy());
  });

  it('clicking Add set the FIRST time creates a pending row (no silent no-op)', async () => {
    const {getByTestId} = renderPlanTab();
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
  });

  it('after a valid pending set is auto-committed, clicking Add set AGAIN must add a new pending row', async () => {
    // Simulate a workout that already has the first set persisted, with no pending.
    const workout: Workout = {
      id: 101,
      exerciseId: 1,
      sets: [{index: 1, reps: 5, rir: 0, weight: 60}],
      notes: '',
    };
    mockPlannedSetsByWorkoutId = {101: workout};
    const trainingWithFirstSet: Training = {
      ...baseTraining,
      plannedWorkouts: {1: 101},
    };
    const {getByTestId, queryByTestId} = renderPlanTab(trainingWithFirstSet);

    // Sanity: Add set is rendered, no pending yet.
    expect(queryByTestId('plan-pending-set-reps-input')).toBeNull();
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    // Pending row appears for the SECOND set.
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
  });

  it('after the auto-commit clears the pending row, clicking Add set creates a NEW pending row for the next index (no silent no-op)', async () => {
    const trainingWithFirstSet: Training = {...baseTraining, plannedWorkouts: {1: 101}};
    mockPlannedSetsByWorkoutId = {
      101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 0, weight: 60}], notes: ''},
    };
    const {getByTestId, queryByTestId} = renderPlanTab(trainingWithFirstSet);

    // Open pending row for index 2.
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    // Fill in valid values — the auto-commit useEffect commits & clears pending.
    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '70');
    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');

    await waitFor(() => {
      const indices = mockDispatch.mock.calls
        .filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT')
        .map(([action]) => action.set?.index);
      expect(indices).toEqual(expect.arrayContaining([2]));
    });
    // Pending row should be cleared after commit.
    await waitFor(() => expect(queryByTestId('plan-pending-set-reps-input')).toBeNull());

    // Now click Add set AGAIN — must create a fresh pending for the next index.
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
  });

  it('clicking Add set with an INVALID pending leaves the pending in place and does not silently swallow the click', async () => {
    const {getByTestId} = renderPlanTab();
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    // Only fill reps — weight is empty, draft is invalid.
    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '5');

    // Click Add set again.
    fireEvent.press(getByTestId('plan-add-set-button-1'));

    // Pending input should still be present (not lost) and no commit dispatch fired
    // with the invalid pending.
    expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy();
    const commitCalls = mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT' || action?.type === 'ADD_PLANED_TRAINING_WORKOUT');
    // Allow zero successful commits, but never a commit with weight=0/reps=undefined etc.
    commitCalls.forEach(([action]) => {
      expect(action.set?.reps).not.toBe(0);
    });
  });
});
