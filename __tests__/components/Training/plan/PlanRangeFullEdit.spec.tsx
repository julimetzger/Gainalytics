import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import PlanTab, {PlanChromeState} from '../../../../app/components/Training/plan/PlanTab';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

// GH-63: planning a range instead of a fixed value. These tests drive the real
// PlanEditList through PlanTab, so they cover the whole path from the range
// toggle down to what actually lands in Redux.

const mockAddPlannedWorkout = jest.fn();
const mockDeleteSetFromWorkout = jest.fn();
const mockReplaceWorkoutSets = jest.fn();
const mockDispatch = jest.fn();
let mockPlannedSetsByWorkoutId: Record<number, Workout> = {};
let latestChromeState: PlanChromeState | null = null;

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
jest.mock('../../../../app/redux/Workout/use/useAllTimeOneRepMax', () => ({
  useAllTimeOneRepMax: () => 0,
}));
jest.mock('../../../../app/components/picker/elements/TrainingElementPicker', () => () => null);
jest.mock('../../../../app/components/Training/plan/MuscleInvolvementCard', () => () => null);
jest.mock('../../../../app/components/Training/DraggableExercise', () => () => null);

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');

  const DialogBase = ({visible, children}: {visible: boolean; children: React.ReactNode}) => (visible ? <View>{children}</View> : null);
  DialogBase.Title = ({children}: {children: React.ReactNode}) => <Text>{children}</Text>;
  DialogBase.Content = ({children}: {children: React.ReactNode}) => <View>{children}</View>;
  DialogBase.Actions = ({children}: {children: React.ReactNode}) => <View>{children}</View>;

  return {
    Button: ({children, onPress, testID}: {children: React.ReactNode; onPress?: () => void; testID?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Chip: ({children, testID}: {children: React.ReactNode; testID?: string}) => (
      <View testID={testID}>
        <Text>{children}</Text>
      </View>
    ),
    Dialog: DialogBase,
    // GH-63: the range error message is a HelperText — without it in the mock
    // the whole row fails to render with "Element type is invalid".
    HelperText: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
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
    TextInput: ({label, value, onChangeText, onBlur, testID}: {label?: string; value?: string; onChangeText?: (value: string) => void; onBlur?: () => void; testID?: string}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onBlur={onBlur} testID={testID} />
    ),
    ToggleButton: ({onPress, testID, status}: {onPress?: () => void; testID?: string; status?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress} accessibilityState={{checked: status === 'checked'}}>
        <Text>{status}</Text>
      </TouchableOpacity>
    ),
    useTheme: () => ({
      colors: {
        elevation: {level3: '#222'},
        onSurfaceVariant: '#888',
        onSurfaceDisabled: '#555',
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
  return {__esModule: true, default: Component, NestableDraggableFlatList: Component, ScaleDecorator, useNestableScrollContainerContext: () => undefined};
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

const baseTraining: Training = {
  id: 11,
  state: TrainingsState.PLANNED,
  exercises: [1],
  doneWorkoutIds: {},
  plannedWorkouts: {1: 101},
};

const buildFullEditProps = () => ({
  training: baseTraining,
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
  onChromeChange: (state: PlanChromeState) => {
    latestChromeState = state;
  },
});

const renderInFullEdit = () => {
  const props = buildFullEditProps();
  latestChromeState = null;
  const utils = render(<PlanTab {...props} editPlanRequestId={0} />);
  utils.rerender(<PlanTab {...props} editPlanRequestId={1} />);
  return utils;
};

const upsertActions = () =>
  mockDispatch.mock.calls
    .filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT')
    .map(([action]) => action);

const withSets = (sets: Workout['sets']) => {
  mockPlannedSetsByWorkoutId = {101: {id: 101, exerciseId: 1, sets, notes: ''}};
  return renderInFullEdit();
};

beforeEach(() => {
  jest.clearAllMocks();
  latestChromeState = null;
  mockPlannedSetsByWorkoutId = {};
});

describe('PlanTab full edit — planning a range (GH-63)', () => {
  it('keeps a set without a range on the plain single-value row', () => {
    const {queryByTestId, getByTestId} = withSets([{index: 1, reps: 8, rir: 1, weight: 100}]);

    expect({
      reps: getByTestId('plan-set-1-reps-input').props.value,
      repsMax: queryByTestId('plan-set-1-reps-max-input'),
      rirMax: queryByTestId('plan-set-1-rir-max-input'),
      weightMax: queryByTestId('plan-set-1-weight-max-input'),
      error: queryByTestId('plan-set-1-range-error'),
    }).toEqual({reps: '8', repsMax: null, rirMax: null, weightMax: null, error: null});
  });

  it('reveals a second value per field when the range toggle is switched on', () => {
    const {getByTestId} = withSets([{index: 1, reps: 8, rir: 1, weight: 100}]);

    act(() => {
      fireEvent.press(getByTestId('plan-exercise-ranges-toggle-1'));
    });

    expect({
      reps: getByTestId('plan-set-1-reps-max-input').props.value,
      rir: getByTestId('plan-set-1-rir-max-input').props.value,
      weight: getByTestId('plan-set-1-weight-max-input').props.value,
    }).toEqual({reps: '', rir: '', weight: ''});
  });

  it('stores the upper bounds of all three fields when the row is left', () => {
    const {getByTestId} = withSets([{index: 1, reps: 8, rir: 1, weight: 100}]);

    act(() => {
      fireEvent.press(getByTestId('plan-exercise-ranges-toggle-1'));
    });
    act(() => {
      fireEvent.changeText(getByTestId('plan-set-1-reps-max-input'), '12');
      fireEvent.changeText(getByTestId('plan-set-1-rir-max-input'), '3');
      fireEvent.changeText(getByTestId('plan-set-1-weight-max-input'), '110');
      fireEvent(getByTestId('plan-set-1-weight-max-input'), 'blur');
    });

    expect(upsertActions()).toEqual([
      {
        type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
        workoutId: 101,
        set: {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110},
      },
    ]);
  });

  it('shows the range inputs without any toggle when the set already has a range', () => {
    const {getByTestId} = withSets([{index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12}]);

    expect({
      repsMax: getByTestId('plan-set-1-reps-max-input').props.value,
      toggle: getByTestId('plan-exercise-ranges-toggle-1').props.accessibilityState.checked,
    }).toEqual({repsMax: '12', toggle: true});
  });

  it('resets a range back to a fixed value when the second value is cleared', () => {
    const {getByTestId} = withSets([{index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12}]);

    act(() => {
      fireEvent.changeText(getByTestId('plan-set-1-reps-max-input'), '');
      fireEvent(getByTestId('plan-set-1-reps-max-input'), 'blur');
    });

    expect(upsertActions()).toEqual([
      {
        type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
        workoutId: 101,
        set: {index: 1, reps: 8, rir: 1, weight: 100},
      },
    ]);
  });

  it('keeps the upper bound being typed when the store echoes the previous field back', () => {
    // Reproduces what the device does: leaving a field commits it, Redux echoes
    // the new set back into this row, and the row must not re-derive its draft
    // from that echo — the user is already typing the next bound. Planning a
    // range means filling the lower and the upper input back to back, so this
    // path silently dropped the upper bound whenever the lower one had just
    // been edited (GH-63 round 3).
    const props = buildFullEditProps();
    mockPlannedSetsByWorkoutId = {101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 8, rir: 1, weight: 100}], notes: ''}};
    const {getByTestId, rerender} = render(<PlanTab {...props} editPlanRequestId={0} />);
    rerender(<PlanTab {...props} editPlanRequestId={1} />);

    act(() => {
      fireEvent.press(getByTestId('plan-exercise-ranges-toggle-1'));
    });
    act(() => {
      fireEvent.changeText(getByTestId('plan-set-1-rir-input'), '2');
      fireEvent(getByTestId('plan-set-1-rir-input'), 'blur');
    });
    act(() => {
      fireEvent.changeText(getByTestId('plan-set-1-rir-max-input'), '4');
      mockPlannedSetsByWorkoutId = {101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 8, rir: 2, weight: 100}], notes: ''}};
      rerender(<PlanTab {...props} editPlanRequestId={1} />);
    });
    act(() => {
      fireEvent(getByTestId('plan-set-1-rir-max-input'), 'blur');
    });

    expect({
      stillShown: getByTestId('plan-set-1-rir-max-input').props.value,
      stored: upsertActions()[upsertActions().length - 1],
    }).toEqual({
      stillShown: '4',
      stored: {
        type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
        workoutId: 101,
        set: {index: 1, reps: 8, rir: 2, weight: 100, rirMax: 4},
      },
    });
  });

  it('refuses an upper bound below the lower bound and explains why', () => {
    const {getByTestId} = withSets([{index: 1, reps: 8, rir: 1, weight: 100}]);

    act(() => {
      fireEvent.press(getByTestId('plan-exercise-ranges-toggle-1'));
    });
    act(() => {
      fireEvent.changeText(getByTestId('plan-set-1-reps-max-input'), '5');
      fireEvent(getByTestId('plan-set-1-reps-max-input'), 'blur');
    });

    expect({
      message: getByTestId('plan-set-1-range-error').props.children,
      stored: upsertActions(),
    }).toEqual({message: 'Reps range: the second value must be greater than 8.', stored: []});
  });

  it('plans a range on a brand new set', () => {
    const {getByTestId} = withSets([]);

    act(() => {
      fireEvent.press(getByTestId('plan-add-set-button-1'));
    });
    act(() => {
      fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');
      fireEvent.changeText(getByTestId('plan-pending-set-rir-input'), '1');
      fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '100');
    });
    act(() => {
      fireEvent.press(getByTestId('plan-exercise-ranges-toggle-1'));
    });
    act(() => {
      fireEvent.changeText(getByTestId('plan-pending-set-reps-max-input'), '12');
    });
    act(() => {
      latestChromeState?.exitToRead();
    });

    expect(upsertActions()).toEqual([
      {
        type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
        workoutId: 101,
        set: {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, date: expect.any(Date)},
      },
    ]);
  });
});
