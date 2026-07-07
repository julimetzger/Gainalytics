/**
 * GH-323 regression: Done button and Rest Timer must remain visible in edit mode.
 *
 * When ExecuteTraining renders with editMode=true and the exercise already has a
 * finalized doneWorkout (end is set), AddWorkout must receive allowRefinalizeWhenDone=true
 * so that the Done button is shown.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {TrainingsState} from '../../../../app/models/TrainingsState';

// --- heavy component mocks ---

const capturedAddWorkoutProps: any[] = [];

jest.mock('../../../../app/components/Workout/add/AddWorkout', () => {
  const {View: V} = require('react-native');
  return (props: any) => {
    capturedAddWorkoutProps.push(props);
    return <V testID="add-workout-mock" />;
  };
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

// --- redux hook mocks ---

const mockUseWorkoutById = jest.fn();
jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: (...args: any[]) => mockUseWorkoutById(...args),
}));

jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(() => 1),
}));

jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(() => undefined),
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
  const Dialog = Object.assign(
    ({visible, children}: any) => (visible ? <V>{children}</V> : null),
    {
      Title: ({children}: any) => <T>{children}</T>,
      Content: ({children}: any) => <V>{children}</V>,
      Actions: ({children}: any) => <V>{children}</V>,
    },
  );
  return {
    Text: ({children, testID}: any) => <T testID={testID}>{children}</T>,
    Icon: () => null,
    IconButton: ({onPress, icon}: any) => (
      <TouchableOpacity onPress={onPress}>
        <T>{icon}</T>
      </TouchableOpacity>
    ),
    Tooltip: ({children}: any) => <>{children}</>,
    Portal: ({children}: any) => <>{children}</>,
    Dialog,
    useTheme: () => ({
      colors: {primary: '#0066ff', error: '#ff0000', onSurface: '#000', onSurfaceVariant: '#666', surface: '#fff', surfaceVariant: '#eee'},
    }),
  };
});

import ExecuteTraining from '../../../../app/components/Training/execute/ExecuteTraining';

const STARTED_TRAINING = {
  id: 1,
  state: TrainingsState.STARTED,
  exercises: [10],
  doneWorkoutIds: {10: 42},
  plannedWorkouts: {},
};

const FINISHED_TRAINING = {
  id: 2,
  state: TrainingsState.FINISHED,
  exercises: [10],
  doneWorkoutIds: {10: 42},
  plannedWorkouts: {},
};

const EXERCISE = {id: 10, name: 'Squat'};

const FINALIZED_WORKOUT = {
  id: 42,
  exerciseId: 10,
  notes: '',
  sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
  start: new Date('2025-01-01'),
  end: new Date('2025-01-01T01:00:00'),
};

describe('ExecuteTraining – editMode (GH-323 regression)', () => {
  beforeEach(() => {
    capturedAddWorkoutProps.length = 0;
    mockUseWorkoutById.mockReturnValue(FINALIZED_WORKOUT);
  });

  it('passes allowRefinalizeWhenDone=true to AddWorkout when editMode=true and doneWorkout has end (STARTED training)', () => {
    render(
      <ExecuteTraining
        training={STARTED_TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        editMode={true}
      />,
    );

    expect(capturedAddWorkoutProps.length).toBeGreaterThan(0);
    const props = capturedAddWorkoutProps[capturedAddWorkoutProps.length - 1];
    expect(props.allowRefinalizeWhenDone).toBe(true);
    expect(props.workout).toEqual(FINALIZED_WORKOUT);
  });

  it('passes allowRefinalizeWhenDone=true to AddWorkout when editMode=true and doneWorkout has end (FINISHED training)', () => {
    render(
      <ExecuteTraining
        training={FINISHED_TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        editMode={true}
      />,
    );

    expect(capturedAddWorkoutProps.length).toBeGreaterThan(0);
    const props = capturedAddWorkoutProps[capturedAddWorkoutProps.length - 1];
    expect(props.allowRefinalizeWhenDone).toBe(true);
    expect(props.workout).toEqual(FINALIZED_WORKOUT);
  });

  it('does NOT pass allowRefinalizeWhenDone when editMode is false (normal mode unchanged)', () => {
    render(
      <ExecuteTraining
        training={STARTED_TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        editMode={false}
      />,
    );

    expect(capturedAddWorkoutProps.length).toBeGreaterThan(0);
    const props = capturedAddWorkoutProps[capturedAddWorkoutProps.length - 1];
    expect(props.allowRefinalizeWhenDone).toBeFalsy();
    // In normal mode, finalized doneWorkout.end causes workout prop to be doneWorkout (not undefined)
    // because the existing condition `doneWorkout?.end ? doneWorkout : undefined` = doneWorkout
    expect(props.workout).toEqual(FINALIZED_WORKOUT);
  });

  it('passes workout=undefined (preserving the suggested-set merge) when editMode=true and doneWorkout is NOT yet finalized (GH-323 P2-a regression)', () => {
    // A STARTED training put into edit mode after the first set of a suggested
    // workout has been logged: doneWorkout is defined but `end` is still
    // undefined. AddWorkout must fall back to workout ?? unfinishedWorkout (the
    // hook merge with remaining suggestedWorkouts sets), so `workout` itself
    // must stay undefined here — passing the raw doneWorkout would drop the
    // remaining suggested sets from the form.
    const UNFINISHED_DONE_WORKOUT = {
      id: 42,
      exerciseId: 10,
      notes: '',
      sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
      start: new Date('2025-01-01'),
      // no `end` — training is still in progress
    };
    mockUseWorkoutById.mockReturnValue(UNFINISHED_DONE_WORKOUT);

    render(
      <ExecuteTraining
        training={STARTED_TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        editMode={true}
      />,
    );

    expect(capturedAddWorkoutProps.length).toBeGreaterThan(0);
    const props = capturedAddWorkoutProps[capturedAddWorkoutProps.length - 1];
    expect(props.allowRefinalizeWhenDone).toBe(true);
    expect(props.workout).toBeUndefined();
  });
});
