import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import PlanTab from '../../../../app/components/Training/plan/PlanTab';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

const mockAddPlannedWorkout = jest.fn();
const mockDeleteSetFromWorkout = jest.fn();
const mockReplaceWorkoutSets = jest.fn();
const mockDispatch = jest.fn();
const mockUseSelector = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0}),
}));

jest.mock('react-redux', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useDispatch: () => mockDispatch,
  useSelector: (selector: unknown) => mockUseSelector(selector),
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

jest.mock('../../../../app/components/Training/plan/MuscleInvolvementCard', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  return ({trainingsPlanId, micro, trainingInMicro}: {trainingsPlanId: number; micro: number; trainingInMicro: number}) => (
    <View testID="muscle-involvement-card-mock">
      <Text>{`muscle-card:${trainingsPlanId}/${micro}/${trainingInMicro}`}</Text>
    </View>
  );
});

jest.mock('../../../../app/components/Training/DraggableExercise', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return () => (
    <View testID="plan-draggable-exercise">
      <Text>Existing draggable exercise picker</Text>
    </View>
  );
});

jest.mock('../../../../app/components/Training/plan/PlanEditList', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return ({exercises, selectedExerciseId}: {exercises: Array<{id: number; name: string}>; selectedExerciseId?: number}) => (
    <View testID="plan-full-edit-list">
      <Text testID="plan-full-edit-selected">{String(selectedExerciseId)}</Text>
      {exercises.map((exercise) => (
        <Text key={exercise.id} testID={`plan-full-edit-exercise-${exercise.id}`}>
          {exercise.name}
        </Text>
      ))}
    </View>
  );
});

jest.mock('../../../../app/components/Training/plan/PlanReadList', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({
    exercises,
    selectedExerciseId,
    mode,
    quickEditInvalid,
    onCellPress,
    onQuickEditChange,
    onQuickEditSubmit,
  }: {
    exercises: Array<{id: number; name: string}>;
    selectedExerciseId?: number;
    mode: 'read' | 'quickEdit';
    quickEditInvalid: boolean;
    onCellPress: (exerciseId: number, setIndex: number, field: 'reps' | 'rir' | 'weight') => void;
    onQuickEditChange: (value: string) => void;
    onQuickEditSubmit: () => void;
  }) => (
    <View>
      <Text testID="plan-read-mode">{mode}</Text>
      <Text testID="plan-read-selected">{String(selectedExerciseId)}</Text>
      <Text testID="plan-read-invalid">{String(quickEditInvalid)}</Text>
      <Text testID="plan-read-exercise-count">{String(exercises.length)}</Text>
      <TouchableOpacity testID="plan-open-weight-cell" onPress={() => onCellPress(1, 2, 'weight')}>
        <Text>Open weight cell</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="plan-open-other-exercise-cell" onPress={() => onCellPress(2, 1, 'reps')}>
        <Text>Open other exercise cell</Text>
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
    Icon: () => null,
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

const plannedWorkoutBench = {
  id: 102,
  exerciseId: 2,
  sets: [{index: 1, reps: 5, rir: 2, weight: 100}],
  notes: '',
} satisfies Workout;

const training = {
  id: 11,
  state: TrainingsState.PLANNED,
  exercises: [1, 2],
  doneWorkoutIds: {},
  plannedWorkouts: {1: 101, 2: 102},
} satisfies Training;

const baseChooseExercise = jest.fn();

const baseProps = {
  training,
  trainingsPlanId: 55,
  micro: 6,
  trainingInMicro: 1,
  exercises,
  chosenExercise: exercises[0],
  chooseExercise: baseChooseExercise,
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

interface MockState {
  workouts: {byId: Record<number, Workout>};
  settings: Record<string, unknown>;
}

const buildMockState = (settings: MockState['settings'] = {}): MockState => ({
  workouts: {
    byId: {
      101: plannedWorkout,
      102: plannedWorkoutBench,
    },
  },
  settings,
});

describe('PlanTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockImplementation((selector: (state: MockState) => unknown) => selector(buildMockState()));
  });

  it('renders all exercises and the existing draggable exercise picker', () => {
    const {getByTestId} = render(<PlanTab {...baseProps} />);

    expect(getByTestId('plan-draggable-exercise')).toBeTruthy();
    expect(getByTestId('plan-read-exercise-count').props.children).toBe('2');
    expect(getByTestId('plan-read-selected').props.children).toBe('1');
  });

  // GH-324: quick edit must NOT write to the store while the user is typing.
  // The value is committed once when the field is left (keyboard OK/Enter,
  // outside press, or switching to another cell).
  it('enters quick edit, holds keystrokes in the draft, and commits once on submit', async () => {
    const {getByTestId} = render(<PlanTab {...baseProps} />);

    fireEvent.press(getByTestId('plan-open-weight-cell'));

    await waitFor(() => {
      expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
    });

    fireEvent.press(getByTestId('plan-enter-invalid-value'));

    await waitFor(() => {
      expect(getByTestId('plan-read-invalid').props.children).toBe('true');
    });

    fireEvent.press(getByTestId('plan-enter-valid-value'));

    await waitFor(() => {
      expect(getByTestId('plan-read-invalid').props.children).toBe('false');
    });

    // Typing a valid value must NOT dispatch yet — the store is only written
    // when the user leaves the field.
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'}),
    );

    // GH-358: the accessory "Done" bar was removed — pressing OK/Enter on the
    // keyboard (onQuickEditSubmit) closes the quick edit and commits the draft.
    fireEvent.press(getByTestId('plan-submit-quick-edit'));

    await waitFor(() => {
      expect(getByTestId('plan-read-mode').props.children).toBe('read');
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
        workoutId: 101,
        set: expect.objectContaining({index: 2, weight: 97.5}),
      }),
    );
    const upserts = mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT');
    expect(upserts.length).toBe(1);
  });

  it('discards the quick-edit draft on submit when it is invalid (store untouched)', async () => {
    const {getByTestId} = render(<PlanTab {...baseProps} />);

    fireEvent.press(getByTestId('plan-open-weight-cell'));
    await waitFor(() => {
      expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
    });

    fireEvent.press(getByTestId('plan-enter-invalid-value'));
    await waitFor(() => {
      expect(getByTestId('plan-read-invalid').props.children).toBe('true');
    });

    // Submit with an invalid draft keeps the quick edit open and never writes.
    fireEvent.press(getByTestId('plan-submit-quick-edit'));
    expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'}),
    );
  });

  it('does NOT render the "Editing … Done" accessory bar in quick edit mode (GH-358 PR #362)', async () => {
    const {getByTestId, queryByTestId} = render(<PlanTab {...baseProps} />);

    fireEvent.press(getByTestId('plan-open-weight-cell'));

    await waitFor(() => {
      expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
    });

    // The bar and its Done button must be gone: saving happens on keyboard
    // OK/Enter (onQuickEditSubmit) or on tapping outside the row.
    expect(queryByTestId('plan-quick-edit-done')).toBeNull();
  });

  it('switches the selected exercise when a cell of a different exercise is tapped', async () => {
    baseChooseExercise.mockReset();
    const {getByTestId} = render(<PlanTab {...baseProps} />);

    fireEvent.press(getByTestId('plan-open-other-exercise-cell'));

    await waitFor(() => {
      expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
    });

    expect(baseChooseExercise).toHaveBeenCalledWith(exercises[1]);
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

  describe('muscle map placement (GH-417)', () => {
    // GH-192 mounted the card inside the Plan tab behind a drawer switch. GH-417
    // moved it into the analysis view's Plan position, so the Plan tab must not
    // render it any more — in any mode, and regardless of leftover settings.
    it('does not render the muscle map in read mode', () => {
      mockUseSelector.mockImplementation((selector: (state: MockState) => unknown) => selector(buildMockState()));

      const {getByTestId, queryByTestId} = render(<PlanTab {...baseProps} />);
      expect(getByTestId('plan-read-mode').props.children).toBe('read');
      expect(queryByTestId('muscle-involvement-card-mock')).toBeNull();
    });

    it('does not render the muscle map in quickEdit mode', async () => {
      mockUseSelector.mockImplementation((selector: (state: MockState) => unknown) => selector(buildMockState()));

      const {getByTestId, queryByTestId} = render(<PlanTab {...baseProps} />);
      fireEvent.press(getByTestId('plan-open-weight-cell'));

      await waitFor(() => {
        expect(getByTestId('plan-read-mode').props.children).toBe('quickEdit');
      });
      expect(queryByTestId('muscle-involvement-card-mock')).toBeNull();
    });

    it('does not render the muscle map in fullEdit mode', async () => {
      mockUseSelector.mockImplementation((selector: (state: MockState) => unknown) => selector(buildMockState()));

      const {getByTestId, queryByTestId, rerender} = render(<PlanTab {...baseProps} />);
      rerender(<PlanTab {...baseProps} editPlanRequestId={1} />);

      await waitFor(() => {
        expect(getByTestId('plan-full-edit-list')).toBeTruthy();
      });
      expect(queryByTestId('muscle-involvement-card-mock')).toBeNull();
    });
  });
});
