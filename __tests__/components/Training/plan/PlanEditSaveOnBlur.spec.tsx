import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import PlanTab, {PlanChromeState} from '../../../../app/components/Training/plan/PlanTab';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

// GH-303 Item 1: number-input edits in Full-Edit mode must NOT persist on each
// keystroke. The committed value should only land in Redux when the field loses
// focus (onBlur) or the keyboard closes. These tests render the real
// PlanEditList so the change in PlanEditSetRow.commitDraft is exercised.

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
    // GH-303: forward `onBlur` so the save-on-blur behaviour is observable in tests.
    TextInput: ({label, value, onChangeText, onBlur, testID}: {label?: string; value?: string; onChangeText?: (value: string) => void; onBlur?: () => void; testID?: string}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onBlur={onBlur} testID={testID} />
    ),
    ToggleButton: ({onPress, testID}: {onPress?: () => void; testID?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>toggle</Text>
      </TouchableOpacity>
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
  return {...utils, props};
};

const exitFullEdit = () => {
  act(() => {
    latestChromeState?.exitToRead();
  });
};

const upsertActions = () =>
  mockDispatch.mock.calls
    .filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT')
    .map(([action]) => action);

const renderInFullEditWithTwoSets = () => {
  mockPlannedSetsByWorkoutId = {
    101: {
      id: 101,
      exerciseId: 1,
      sets: [
        {index: 1, reps: 5, rir: 0, weight: 60},
        {index: 2, reps: 8, rir: 1, weight: 80},
      ],
      notes: '',
    },
  };
  return renderInFullEdit();
};

const rerenderFullEditWithSets = (
  rerender: ReturnType<typeof render>['rerender'],
  props: ReturnType<typeof buildFullEditProps>,
  sets: Workout['sets'],
) => {
  mockPlannedSetsByWorkoutId = {
    101: {
      id: 101,
      exerciseId: 1,
      sets,
      notes: '',
    },
  };
  rerender(<PlanTab {...props} editPlanRequestId={1} />);
};

const upsertDispatchCount = () =>
  mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT').length;

describe('PlanEditSetRow — save on blur (GH-303 Item 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestChromeState = null;
    mockPlannedSetsByWorkoutId = {
      101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 0, weight: 60}], notes: ''},
    };
  });

  it('does NOT dispatch an upsert on every keystroke', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-weight-input')).toBeTruthy());

    const dispatchesBefore = upsertDispatchCount();

    // Simulate a user typing "70" character-by-character into the weight field.
    fireEvent.changeText(getByTestId('plan-set-1-weight-input'), '7');
    fireEvent.changeText(getByTestId('plan-set-1-weight-input'), '70');

    // The change should be held in the local draft only — Redux must not have
    // received a save for either intermediate state.
    expect(upsertDispatchCount()).toBe(dispatchesBefore);
  });

  it('dispatches a single upsert with the final value on blur', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-weight-input')).toBeTruthy());

    const dispatchesBefore = upsertDispatchCount();

    fireEvent.changeText(getByTestId('plan-set-1-weight-input'), '70');
    expect(upsertDispatchCount()).toBe(dispatchesBefore);

    fireEvent(getByTestId('plan-set-1-weight-input'), 'blur');

    await waitFor(() => {
      const upserts = mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT');
      expect(upserts.length).toBe(dispatchesBefore + 1);
      const lastSet = upserts[upserts.length - 1][0].set;
      expect(lastSet.index).toBe(1);
      expect(lastSet.weight).toBe(70);
    });
  });

  // GH-324: "immer speichern beim Verlassen des Feldes" also covers leaving the
  // whole edit mode while an input is still focused — the row unmounts without
  // a blur event, so the changed draft must be committed on unmount.
  it('commits an un-blurred, changed draft when full edit exits (e.g. Done pressed while typing)', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-weight-input')).toBeTruthy());
    await waitFor(() => expect(latestChromeState?.mode).toBe('fullEdit'));

    const dispatchesBefore = upsertDispatchCount();
    fireEvent.changeText(getByTestId('plan-set-1-weight-input'), '75');
    expect(upsertDispatchCount()).toBe(dispatchesBefore);

    exitFullEdit();

    expect(upsertActions()).toEqual([
      {
        set: {
          index: 1,
          reps: 5,
          rir: 0,
          weight: 75,
        },
        type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
        workoutId: 101,
      },
    ]);
  });

  it('does NOT dispatch on full-edit exit when the draft is unchanged', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-weight-input')).toBeTruthy());
    await waitFor(() => expect(latestChromeState?.mode).toBe('fullEdit'));

    const dispatchesBefore = upsertDispatchCount();
    exitFullEdit();
    expect(upsertDispatchCount()).toBe(dispatchesBefore);
  });

  it('does NOT dispatch a stale upsert when an edited row unmounts during reorder', async () => {
    const {getByTestId, rerender, props} = renderInFullEditWithTwoSets();
    await waitFor(() => expect(getByTestId('plan-set-2-weight-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('plan-set-1-weight-input'), '75');
    expect(upsertActions()).toEqual([]);

    rerenderFullEditWithSets(rerender, props, [
      {index: 1, reps: 8, rir: 1, weight: 80},
      {index: 2, reps: 5, rir: 0, weight: 60},
    ]);

    await waitFor(() => expect(getByTestId('plan-set-1-weight-input').props.value).toBe('80'));
    expect(upsertActions()).toEqual([]);
  });

  it('does NOT dispatch a stale upsert when an edited row unmounts during delete', async () => {
    const {getByTestId, queryByTestId, rerender, props} = renderInFullEditWithTwoSets();
    await waitFor(() => expect(getByTestId('plan-set-2-weight-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('plan-set-1-weight-input'), '75');
    expect(upsertActions()).toEqual([]);

    rerenderFullEditWithSets(rerender, props, [{index: 2, reps: 8, rir: 1, weight: 80}]);

    await waitFor(() => expect(queryByTestId('plan-set-1-weight-input')).toBeNull());
    expect(getByTestId('plan-set-2-weight-input').props.value).toBe('80');
    expect(upsertActions()).toEqual([]);
  });

  // GH-324: the 1RM suggestion button is always visible on saved rows too.
  it('renders the 1RM toggle on saved set rows', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-1rm-toggle')).toBeTruthy());
  });

  it('does not auto-change the weight draft when typing reps while the 1RM toggle is off (saved-row default)', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-weight-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('plan-set-1-reps-input'), '9');
    expect(getByTestId('plan-set-1-weight-input').props.value).toBe('60');
  });

  it('blurring without value change does not dispatch a redundant upsert with an invalid value', async () => {
    const {getByTestId} = renderInFullEdit();
    await waitFor(() => expect(getByTestId('plan-set-1-reps-input')).toBeTruthy());

    const dispatchesBefore = upsertDispatchCount();

    // Clear the field to make the draft invalid, then blur. The new
    // commitDraft path returns early when the built set is null, so Redux
    // must not see a 0/NaN write.
    fireEvent.changeText(getByTestId('plan-set-1-reps-input'), '');
    fireEvent(getByTestId('plan-set-1-reps-input'), 'blur');

    await waitFor(() => {
      const newUpserts = mockDispatch.mock.calls
        .slice(dispatchesBefore)
        .filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT');
      newUpserts.forEach(([action]) => {
        expect(Number.isFinite(action.set.reps)).toBe(true);
        expect(action.set.reps).toBeGreaterThan(0);
      });
    });
  });
});
