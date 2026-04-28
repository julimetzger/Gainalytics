import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import PlanTab from '../../../../app/components/Training/plan/PlanTab';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

const mockAddPlannedWorkout = jest.fn();
const mockAddOrUpdateSetInWorkout = jest.fn();
const mockDeleteSetFromWorkout = jest.fn();
const mockReplaceWorkoutSets = jest.fn();
const mockUseSelector = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0}),
}));

jest.mock('react-redux', () => ({
  useSelector: (selector: unknown) => mockUseSelector(selector),
}));

jest.mock('../../../../app/redux/Training/dispatch/plan/dispatchAddPlanedTrainingWorkout', () => ({
  dispatchAddPlanedTrainingWorkout: () => mockAddPlannedWorkout,
}));

jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: () => 900,
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout', () => ({
  dispatchAddOrUpdateSetInWorkout: () => mockAddOrUpdateSetInWorkout,
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout', () => ({
  dispatchDeleteSetFromWorkout: () => mockDeleteSetFromWorkout,
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchReplaceWorkoutSets', () => ({
  dispatchReplaceWorkoutSets: () => mockReplaceWorkoutSets,
}));

jest.mock('../../../../app/components/picker/elements/TrainingElementPicker', () => () => null);

jest.mock('../../../../app/components/Training/plan/PlanExerciseStrip', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return () => (
    <View testID="plan-exercise-strip">
      <Text>Exercise strip</Text>
    </View>
  );
});

jest.mock('../../../../app/components/Training/plan/PlanEditList', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return () => (
    <View testID="plan-full-edit-list">
      <Text>Full edit list</Text>
    </View>
  );
});

jest.mock('../../../../app/components/Training/plan/PlanReadList', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({
    mode,
    quickEditInvalid,
    onCellPress,
    onQuickEditChange,
    onQuickEditSubmit,
  }: {
    mode: 'read' | 'quickEdit';
    quickEditInvalid: boolean;
    onCellPress: (setIndex: number, field: 'reps' | 'rir' | 'weight') => void;
    onQuickEditChange: (value: string) => void;
    onQuickEditSubmit: () => void;
  }) => (
    <View>
      <Text testID="plan-read-mode">{mode}</Text>
      <Text testID="plan-read-invalid">{String(quickEditInvalid)}</Text>
      <TouchableOpacity testID="plan-open-weight-cell" onPress={() => onCellPress(2, 'weight')}>
        <Text>Open weight cell</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="plan-enter-invalid-value" onPress={() => onQuickEditChange('1000.1')}>
        <Text>Enter invalid</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="plan-enter-valid-value" onPress={() => onQuickEditChange('97.5')}>
        <Text>Enter valid</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="plan-submit-quick-edit" onPress={onQuickEditSubmit}>
        <Text>Submit</Text>
      </TouchableOpacity>
    </View>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

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
    Dialog: DialogBase,
    Portal: ({children}: {children: React.ReactNode}) => <>{children}</>,
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({
      colors: {
        elevation: {level3: '#222'},
        onSurfaceVariant: '#888',
        primary: '#3f51b5',
        error: '#b00020',
        surfaceVariant: '#111',
        onSurface: '#fff',
      },
    }),
  };
});

const exercises = [
  {id: 1, name: 'Pull up', alternativeIds: []},
  {id: 2, name: 'Bench', alternativeIds: []},
] satisfies Exercise[];

const plannedWorkout = {
  id: 101,
  exerciseId: 1,
  sets: [
    {index: 1, reps: 8, rir: 2, weight: 92.5},
    {index: 2, reps: 8, rir: 2, weight: 95},
  ],
  notes: '',
} satisfies Workout;

const training = {
  id: 11,
  state: TrainingsState.PLANNED,
  exercises: [1, 2],
  doneWorkoutIds: {},
  plannedWorkouts: {1: 101},
} satisfies Training;

const baseProps = {
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
  editPlanRequestId: 0,
  isActive: true,
  onChromeChange: jest.fn(),
};

describe('PlanTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockImplementation((selector: (state: {workouts: {byId: Record<number, Workout>}}) => unknown) =>
      selector({
        workouts: {
          byId: {
            101: plannedWorkout,
          },
        },
      }),
    );
  });

  it('enters quick edit, validates values, and commits valid weight updates immediately', async () => {
    const {getByTestId, queryByTestId} = render(<PlanTab {...baseProps} />);

    fireEvent.press(getByTestId('plan-open-weight-cell'));

    await waitFor(() => {
      expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
      expect(getByTestId('plan-quick-edit-done')).toBeTruthy();
    });

    fireEvent.press(getByTestId('plan-enter-invalid-value'));

    await waitFor(() => {
      expect(getByTestId('plan-read-invalid').props.children).toBe('true');
    });

    fireEvent.press(getByTestId('plan-enter-valid-value'));

    await waitFor(() => {
      expect(getByTestId('plan-read-invalid').props.children).toBe('false');
    });

    expect(mockAddOrUpdateSetInWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 2,
        weight: 97.5,
      }),
      plannedWorkout,
    );

    fireEvent.press(getByTestId('plan-quick-edit-done'));

    await waitFor(() => {
      expect(queryByTestId('plan-quick-edit-done')).toBeNull();
      expect(getByTestId('plan-read-mode').props.children).toBe('read');
    });
  });

  it('enters full edit mode when the parent increments the edit plan request id', async () => {
    const {getByTestId, rerender} = render(<PlanTab {...baseProps} />);

    expect(getByTestId('plan-read-mode').props.children).toBe('read');

    rerender(<PlanTab {...baseProps} editPlanRequestId={1} />);

    await waitFor(() => {
      expect(getByTestId('plan-full-edit-list')).toBeTruthy();
    });

    expect(baseProps.onChromeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: 'fullEdit',
      }),
    );
  });
});
