import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
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
// GH-406: useAllTimeOneRepMax reads workouts.byExerciseId — the 1RM tests below
// seed a FINISHED workout here so the suggestion logic is actually reachable.
let mockWorkoutIdsByExerciseId: Record<number, number[]> = {};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0}),
}));

jest.mock('react-redux', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      workouts: {byId: mockPlannedSetsByWorkoutId, byExerciseId: mockWorkoutIdsByExerciseId},
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

jest.mock('../../../../app/components/picker/filter/ExerciseSearchSheet', () => () => null);


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
    TextInput: ({label, value, onChangeText, testID, selectTextOnFocus}: {label?: string; value?: string; onChangeText?: (value: string) => void; testID?: string; selectTextOnFocus?: boolean}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} testID={testID} selectTextOnFocus={selectTextOnFocus} />
    ),
    ToggleButton: ({onPress, testID, disabled}: {onPress?: () => void; testID?: string; disabled?: boolean}) => (
      <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} disabled={disabled}>
        <Text>1RM</Text>
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

const baseTraining = {
  id: 11,
  state: TrainingsState.PLANNED,
  exercises: [1],
  doneWorkoutIds: {},
  plannedWorkouts: {},
} satisfies Training;

const renderPlanTab = (training: Training = baseTraining, onChromeChange?: (state: {exitToRead: () => void}) => void) => {
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
    onChromeChange,
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
    mockWorkoutIdsByExerciseId = {};
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

  // GH-324: typing valid values must NOT auto-commit the pending row anymore —
  // that converted the row mid-typing and threw the user out of the field. The
  // pending commits when the user leaves the flow: "Add set" again or Done.
  it('typing valid values keeps the pending row pending (no auto-commit per keystroke)', async () => {
    const trainingWithFirstSet: Training = {...baseTraining, plannedWorkouts: {1: 101}};
    mockPlannedSetsByWorkoutId = {
      101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 0, weight: 60}], notes: ''},
    };
    const {getByTestId} = renderPlanTab(trainingWithFirstSet);

    // Open pending row for index 2.
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    // Fill in valid values — the draft is complete, but nothing may be written.
    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '70');
    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');

    expect(
      mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT').length,
    ).toBe(0);
    // The pending row is still there — the user keeps typing undisturbed.
    expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy();
  });

  it('clicking Add set AGAIN commits the valid pending and creates a fresh pending for the next index', async () => {
    const trainingWithFirstSet: Training = {...baseTraining, plannedWorkouts: {1: 101}};
    mockPlannedSetsByWorkoutId = {
      101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 0, weight: 60}], notes: ''},
    };
    const {getByTestId} = renderPlanTab(trainingWithFirstSet);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '70');
    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');

    // Second Add set press: commits the valid pending (index 2) …
    fireEvent.press(getByTestId('plan-add-set-button-1'));

    await waitFor(() => {
      const indices = mockDispatch.mock.calls
        .filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT')
        .map(([action]) => action.set?.index);
      expect(indices).toEqual(expect.arrayContaining([2]));
    });
    // … and a fresh pending row exists for the next set.
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
  });

  it('leaving full edit (Done) commits the valid pending draft exactly once', async () => {
    const trainingWithFirstSet: Training = {...baseTraining, plannedWorkouts: {1: 101}};
    mockPlannedSetsByWorkoutId = {
      101: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 0, weight: 60}], notes: ''},
    };
    let chrome: {exitToRead: () => void} | undefined;
    const {getByTestId} = renderPlanTab(trainingWithFirstSet, (state) => {
      chrome = state;
    });

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '70');
    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');
    expect(
      mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT').length,
    ).toBe(0);

    // Simulate the header Done button (chrome exitToRead).
    act(() => {
      chrome?.exitToRead();
    });

    await waitFor(() => {
      const upserts = mockDispatch.mock.calls.filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT');
      expect(upserts.length).toBe(1);
      expect(upserts[0][0].set).toEqual(expect.objectContaining({index: 2, reps: 8, weight: 70}));
    });
  });

  it('always renders the 1RM toggle on the pending row, even when the exercise has no recorded 1RM (GH-324)', async () => {
    const {getByTestId} = renderPlanTab();
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    // No workout history in this state → no 1RM — the toggle must still render.
    expect(getByTestId('plan-pending-set-1rm-toggle')).toBeTruthy();
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

// GH-406 (UX-Audit finding M5): "Add set" used to produce an entirely empty row
// (reps '', weight '', RIR '0') even when the set above already held 8 / 0 / 118.
// A new set now carries over reps, RIR and weight from the previous set of the
// SAME exercise, so the common case (straight sets) needs no typing at all.
describe('PlanTab — Add set carries the previous set over (GH-406)', () => {
  const upsertedSets = () =>
    mockDispatch.mock.calls
      .filter(([action]) => action?.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT')
      .map(([action]) => action.set);

  const workoutWithSets = (sets: Workout['sets']): Workout => ({id: 101, exerciseId: 1, sets, notes: ''});

  const trainingWithWorkout: Training = {...baseTraining, plannedWorkouts: {1: 101}};

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlannedSetsByWorkoutId = {};
    mockWorkoutIdsByExerciseId = {};
  });

  it('prefills reps, RIR and weight from the previous saved set of the same exercise', async () => {
    mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 2, weight: 118}])};
    const {getByTestId} = renderPlanTab(trainingWithWorkout);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    expect(getByTestId('plan-pending-set-reps-input').props.value).toBe('8');
    expect(getByTestId('plan-pending-set-rir-input').props.value).toBe('2');
    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('118');
  });

  it('carries over a decimal weight verbatim', async () => {
    mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 5, rir: 1, weight: 62.5}])};
    const {getByTestId} = renderPlanTab(trainingWithWorkout);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-weight-input')).toBeTruthy());

    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('62.5');
  });

  it('takes the HIGHEST-index set as the predecessor, not the array order', async () => {
    mockPlannedSetsByWorkoutId = {
      101: workoutWithSets([
        {index: 2, reps: 6, rir: 1, weight: 130},
        {index: 1, reps: 8, rir: 2, weight: 118},
      ]),
    };
    const {getByTestId} = renderPlanTab(trainingWithWorkout);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    expect(getByTestId('plan-pending-set-reps-input').props.value).toBe('6');
    expect(getByTestId('plan-pending-set-rir-input').props.value).toBe('1');
    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('130');
  });

  // AC: the FIRST set of an exercise has no predecessor and must behave exactly
  // as before — empty reps/weight and RIR '0', never 'undefined'/'NaN'/'0' kg.
  it('leaves the FIRST set of an exercise at the unchanged empty default', async () => {
    const {getByTestId} = renderPlanTab();

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    expect(getByTestId('plan-pending-set-reps-input').props.value).toBe('');
    expect(getByTestId('plan-pending-set-rir-input').props.value).toBe('0');
    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('');
  });

  it('keeps the carried-over values editable — nothing is locked', async () => {
    mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 2, weight: 118}])};
    const {getByTestId} = renderPlanTab(trainingWithWorkout);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '5');
    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '125');

    expect(getByTestId('plan-pending-set-reps-input').props.value).toBe('5');
    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('125');
    // The untouched field keeps the carried-over value.
    expect(getByTestId('plan-pending-set-rir-input').props.value).toBe('2');
  });

  // The interaction-count claim of the ticket, mechanised: with set 1 in place,
  // sets 2 and 3 of a 3x8 are produced by two "Add set" taps and the Done exit —
  // zero text entries — and all three sets carry identical values.
  it('completes a 3x8 with two taps and no typing once set 1 exists', async () => {
    mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 0, weight: 100}])};
    let chrome: {exitToRead: () => void} | undefined;
    const {getByTestId} = renderPlanTab(trainingWithWorkout, (state) => {
      chrome = state;
    });

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(upsertedSets().length).toBe(1));

    act(() => {
      chrome?.exitToRead();
    });

    await waitFor(() => expect(upsertedSets().length).toBe(2));
    expect(upsertedSets()).toEqual([
      expect.objectContaining({index: 2, reps: 8, rir: 0, weight: 100}),
      expect.objectContaining({index: 3, reps: 8, rir: 0, weight: 100}),
    ]);
  });

  it('carries over from the pending row that the same tap just committed', async () => {
    mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 0, weight: 100}])};
    const {getByTestId} = renderPlanTab(trainingWithWorkout);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    // The user deviates on set 2 …
    fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '6');
    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '110');

    // … and set 3 must follow set 2, not the stale set 1 from the store.
    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(upsertedSets().length).toBe(1));

    expect(getByTestId('plan-pending-set-reps-input').props.value).toBe('6');
    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('110');
  });

  it('keeps an invalid pending row untouched instead of carrying it over', async () => {
    mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 0, weight: 100}])};
    const {getByTestId} = renderPlanTab(trainingWithWorkout);

    fireEvent.press(getByTestId('plan-add-set-button-1'));
    await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

    // Blank the carried-over weight — the draft is now invalid.
    fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '');
    fireEvent.press(getByTestId('plan-add-set-button-1'));

    expect(upsertedSets()).toEqual([]);
    expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('');
    expect(getByTestId('plan-pending-set-reps-input').props.value).toBe('8');
  });

  describe('1RM weight suggestion (unchanged, must not collide with the carry-over)', () => {
    // A FINISHED workout at 100 kg x 1 @ RIR 0 gives an all-time 1RM of 100.
    const seedOneRepMax = () => {
      mockWorkoutIdsByExerciseId = {1: [900]};
      mockPlannedSetsByWorkoutId = {
        ...mockPlannedSetsByWorkoutId,
        900: {
          id: 900,
          exerciseId: 1,
          sets: [{index: 1, reps: 1, rir: 0, weight: 100}],
          notes: '',
          end: new Date('2026-01-01'),
        } as Workout,
      };
    };

    it('still auto-suggests the weight from the 1RM on the FIRST set', async () => {
      seedOneRepMax();
      const {getByTestId} = renderPlanTab();

      fireEvent.press(getByTestId('plan-add-set-button-1'));
      await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());

      fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');

      // 100 / (1 + 8/30) = 78.9 -> "79"
      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('79'));
    });

    // GH-436 usability walk: the suggestion lands in the field while the user is
    // still typing reps; a tap then appended to it ("60" over "118" -> "11860").
    it('selects the suggested weight on focus so typing replaces it, and stops once the user typed their own', async () => {
      seedOneRepMax();
      const {getByTestId} = renderPlanTab();

      fireEvent.press(getByTestId('plan-add-set-button-1'));
      await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
      // nothing suggested yet → nothing to select
      expect(getByTestId('plan-pending-set-weight-input').props.selectTextOnFocus).toBeFalsy();

      fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');
      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('79'));
      expect(getByTestId('plan-pending-set-weight-input').props.selectTextOnFocus).toBe(true);

      fireEvent.changeText(getByTestId('plan-pending-set-weight-input'), '60');
      expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('60');
      expect(getByTestId('plan-pending-set-weight-input').props.selectTextOnFocus).toBe(false);
    });

    it('does NOT let the 1RM suggestion overwrite a carried-over weight', async () => {
      mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 0, weight: 118}])};
      seedOneRepMax();
      const {getByTestId} = renderPlanTab(trainingWithWorkout);

      fireEvent.press(getByTestId('plan-add-set-button-1'));
      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('118'));

      // Editing reps on a carried-over row must keep the planned weight.
      fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '6');

      expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('118');
    });

    it('recomputes the weight from the 1RM when the user opts back in via the toggle', async () => {
      mockPlannedSetsByWorkoutId = {101: workoutWithSets([{index: 1, reps: 8, rir: 0, weight: 118}])};
      seedOneRepMax();
      const {getByTestId} = renderPlanTab(trainingWithWorkout);

      fireEvent.press(getByTestId('plan-add-set-button-1'));
      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('118'));

      fireEvent.press(getByTestId('plan-pending-set-1rm-toggle'));

      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('79'));
    });

    it('re-arms the 1RM suggestion for each new pending row', async () => {
      seedOneRepMax();
      const {getByTestId} = renderPlanTab();

      // Set 1: no predecessor -> suggestion active.
      fireEvent.press(getByTestId('plan-add-set-button-1'));
      await waitFor(() => expect(getByTestId('plan-pending-set-reps-input')).toBeTruthy());
      fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '8');
      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('79'));

      // Set 2 carries 8 / 0 / 79 over; editing reps must NOT re-suggest now.
      fireEvent.press(getByTestId('plan-add-set-button-1'));
      await waitFor(() => expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('79'));
      fireEvent.changeText(getByTestId('plan-pending-set-reps-input'), '3');

      expect(getByTestId('plan-pending-set-weight-input').props.value).toBe('79');
    });
  });
});
