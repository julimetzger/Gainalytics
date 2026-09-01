import React from 'react';
import {render} from '@testing-library/react-native';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Training} from '../../../../app/models/entities/Training';
import {Workout} from '../../../../app/models/entities/Workout';

/**
 * GH-63 round 2 (PR #429 review).
 *
 * On START_TRAINING the planned workout is copied into `suggestedWorkouts`, and
 * `useUnfinishedWorkout` merges that copy into the workout it returns. So the
 * merged workout contains the planned-but-unlogged sets as pending rows. Both
 * the target banner and the "Set N" label used to be derived from that merged
 * workout, which made them count sets the user had not logged yet:
 *
 *   - 2 planned sets, nothing logged -> banner named the LAST planned set and
 *     the label already said "Set 3"
 *   - delete the middle of 3 planned sets -> the target jumped to the end
 *
 * This suite pins both readouts to what has ACTUALLY been logged, and asserts
 * banner and label always name the same number.
 */

// --- heavy component mocks ---

jest.mock('../../../../app/components/Workout/add/AddWorkout', () => {
  const {View: V, Text: T} = require('react-native');
  return (props: any) => (
    <V testID="add-workout-mock">
      {/* AddWorkout renders " Set {nextSetIndex}" whenever the prop is set and
          falls back to its own counter otherwise (covered in AddWorkout.spec). */}
      <T testID="add-workout-set-number">{props.nextSetIndex === undefined ? 'own-counter' : ` Set ${props.nextSetIndex}`}</T>
    </V>
  );
});

jest.mock('../../../../app/components/Training/execute/RestTimerCard', () => {
  const {View: V} = require('react-native');
  return () => <V />;
});

jest.mock('../../../../app/components/picker/date/DatePicker', () => {
  const {View: V} = require('react-native');
  return () => <V />;
});

jest.mock('../../../../app/components/exercise/show/ExerciseHistory', () => {
  const {View: V} = require('react-native');
  return () => <V />;
});

jest.mock('../../../../app/components/Workout/show/WorkoutSetView', () => {
  const {View: V} = require('react-native');
  return () => <V />;
});

jest.mock('../../../../app/components/Training/execute/Estimated1RmCard', () => {
  const {View: V} = require('react-native');
  return () => <V />;
});

jest.mock('../../../../app/components/Training/execute/ExerciseRecordsModal', () => () => null);

// --- redux hook mocks ---

jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(() => 1),
}));

jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(() => undefined),
  usePersistedUnfinishedWorkout: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/Workout/use/useAllTimeOneRepMax', () => ({
  useAllTimeOneRepMax: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(() => ({restTimer: {}})),
}));

jest.mock('../../../../app/redux/settings/dispatch/dispatchRestTimer', () => ({
  dispatchStartRestTimer: jest.fn(() => jest.fn()),
  dispatchResetRestTimer: jest.fn(() => jest.fn()),
  dispatchUpdateRestTimerTarget: jest.fn(() => jest.fn()),
  dispatchDismissRestTimer: jest.fn(() => jest.fn()),
  dispatchSetRestTimerExerciseDefault: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../app/redux/Workout/use/useLastFinishedWorkoutsByExerciseIds', () => ({
  useLastFinishedWorkoutsByExerciseIds: jest.fn(() => []),
}));

jest.mock('react-native-paper', () => {
  const {View: V, Text: T, TouchableOpacity} = require('react-native');
  const Dialog = Object.assign(({visible, children}: any) => (visible ? <V>{children}</V> : null), {
    Title: ({children}: any) => <T>{children}</T>,
    Content: ({children}: any) => <V>{children}</V>,
    Actions: ({children}: any) => <V>{children}</V>,
    ScrollArea: ({children}: any) => <V>{children}</V>,
  });
  return {
    Button: ({children, onPress}: any) => (
      <TouchableOpacity onPress={onPress}>
        <T>{children}</T>
      </TouchableOpacity>
    ),
    Dialog,
    Text: ({children, testID}: any) => <T testID={testID}>{children}</T>,
    Icon: ({source}: any) => <T>{source}</T>,
    IconButton: ({onPress, icon}: any) => (
      <TouchableOpacity onPress={onPress}>
        <T>{icon}</T>
      </TouchableOpacity>
    ),
    Tooltip: ({children}: any) => <>{children}</>,
    Portal: ({children}: any) => <>{children}</>,
    useTheme: () => ({colors: {primary: '#0066ff', onSurface: '#000', onSurfaceVariant: '#666'}}),
  };
});

// ---

import ExecuteTraining from '../../../../app/components/Training/execute/ExecuteTraining';

const mockedUseWorkoutById = require('../../../../app/redux/Workout/use/useWorkoutById').useWorkoutById as jest.Mock;
const mockedUseUnfinishedWorkout = require('../../../../app/redux/Workout/use/useUnfinishedWorkout').useUnfinishedWorkout as jest.Mock;
const mockedUsePersistedUnfinishedWorkout = require('../../../../app/redux/Workout/use/useUnfinishedWorkout')
  .usePersistedUnfinishedWorkout as jest.Mock;

const EXERCISE = {id: 10, name: 'Squat'} satisfies Exercise;
const TRAINING = {
  id: 1,
  doneWorkoutIds: {},
  plannedWorkouts: {10: 77},
  exercises: [10],
  state: TrainingsState.STARTED,
} satisfies Training;

const planned = (sets: Array<{index: number; reps: number; rir: number; weight: number; repsMax?: number}>) =>
  ({id: 77, exerciseId: 10, sets}) satisfies Workout;

const PLANNED_THREE = planned([
  {index: 1, reps: 8, rir: 2, weight: 100, repsMax: 12},
  {index: 2, reps: 6, rir: 1, weight: 110},
  {index: 3, reps: 4, rir: 0, weight: 120},
]);

/**
 * Renders the training screen in the state the app is really in: the planned
 * workout is also present as the suggested copy inside the merged unfinished
 * workout, minus the indices that have already been logged.
 */
const renderWithLogged = (plannedWorkout: Workout, loggedIndices: number[]) => {
  const loggedSets = loggedIndices.map((index) => ({index, reps: 5, rir: 1, weight: 100, date: new Date('2026-01-01')}));
  const pendingSets = plannedWorkout.sets.filter((set) => !loggedIndices.includes(set.index!));
  const persisted: Workout | undefined = loggedSets.length > 0 ? {id: 900, exerciseId: 10, sets: loggedSets} : undefined;

  mockedUseWorkoutById.mockImplementation((id?: number) => (id === 77 ? plannedWorkout : undefined));
  mockedUsePersistedUnfinishedWorkout.mockReturnValue(persisted);
  mockedUseUnfinishedWorkout.mockReturnValue({
    id: persisted?.id,
    exerciseId: 10,
    sets: [...loggedSets, ...pendingSets].sort((left, right) => left.index! - right.index!),
  } satisfies Workout);

  const {getByTestId, queryByTestId} = render(
    <ExecuteTraining training={TRAINING} chosenExercise={EXERCISE} onSubmit={jest.fn()} />,
  );
  return {
    label: queryByTestId('planned-set-target-label')?.props.children,
    value: queryByTestId('planned-set-target-value')?.props.children,
    setNumber: getByTestId('add-workout-set-number').props.children,
  };
};

describe('ExecuteTraining – planned set target and set number', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('names the FIRST planned set before anything is logged', () => {
    expect(renderWithLogged(PLANNED_THREE, [])).toEqual({
      label: 'Target · Set 1',
      value: '8-12 reps · RIR 2 · 100 kg',
      setNumber: ' Set 1',
    });
  });

  it('advances to the second planned set after the first one is logged', () => {
    expect(renderWithLogged(PLANNED_THREE, [1])).toEqual({
      label: 'Target · Set 2',
      value: '6 reps · RIR 1 · 110 kg',
      setNumber: ' Set 2',
    });
  });

  it('advances to the third planned set after the second one is logged', () => {
    expect(renderWithLogged(PLANNED_THREE, [1, 2])).toEqual({
      label: 'Target · Set 3',
      value: '4 reps · RIR 0 · 120 kg',
      setNumber: ' Set 3',
    });
  });

  it('reports the plan as worked off after the last planned set, and counts on', () => {
    expect(renderWithLogged(PLANNED_THREE, [1, 2, 3])).toEqual({
      label: 'Target',
      value: 'All 3 planned sets logged',
      setNumber: ' Set 4',
    });
  });

  it('does not jump to the end when the middle planned set was deleted', () => {
    // Four planned sets, the second deleted -> 1, 3, 4. The next open set (3)
    // differs from the last one (4), so a "clamp to the end" implementation
    // cannot pass this.
    const withGap = planned([
      {index: 1, reps: 8, rir: 2, weight: 100},
      {index: 3, reps: 4, rir: 0, weight: 120},
      {index: 4, reps: 2, rir: 0, weight: 130},
    ]);
    expect(renderWithLogged(withGap, [])).toEqual({
      label: 'Target · Set 1',
      value: '8 reps · RIR 2 · 100 kg',
      setNumber: ' Set 1',
    });
    expect(renderWithLogged(withGap, [1])).toEqual({
      label: 'Target · Set 3',
      value: '4 reps · RIR 0 · 120 kg',
      setNumber: ' Set 3',
    });
    expect(renderWithLogged(withGap, [1, 3])).toEqual({
      label: 'Target · Set 4',
      value: '2 reps · RIR 0 · 130 kg',
      setNumber: ' Set 4',
    });
  });

  it('works for a plan whose indices do not start at 1', () => {
    const shifted = planned([
      {index: 8, reps: 6, rir: 0, weight: 200, repsMax: 9},
      {index: 9, reps: 5, rir: 0, weight: 200},
    ]);
    expect(renderWithLogged(shifted, [])).toEqual({
      label: 'Target · Set 8',
      value: '6-9 reps · RIR 0 · 200 kg',
      setNumber: ' Set 8',
    });
    expect(renderWithLogged(shifted, [8])).toEqual({
      label: 'Target · Set 9',
      value: '5 reps · RIR 0 · 200 kg',
      setNumber: ' Set 9',
    });
  });

  it('leaves an exercise without a plan completely untouched', () => {
    mockedUseWorkoutById.mockReturnValue(undefined);
    mockedUsePersistedUnfinishedWorkout.mockReturnValue(undefined);
    mockedUseUnfinishedWorkout.mockReturnValue({
      id: 900,
      exerciseId: 10,
      sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
    } satisfies Workout);

    const {queryByTestId, getByTestId} = render(
      <ExecuteTraining training={{...TRAINING, plannedWorkouts: {}} satisfies Training} chosenExercise={EXERCISE} onSubmit={jest.fn()} />,
    );

    // No banner, and AddWorkout keeps its own counter (nextSetIndex undefined).
    expect(queryByTestId('planned-set-target')).toEqual(null);
    expect(getByTestId('add-workout-set-number').props.children).toEqual('own-counter');
  });
});
