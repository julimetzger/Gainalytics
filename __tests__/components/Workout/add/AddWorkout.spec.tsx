import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import AddWorkout from '../../../../app/components/Workout/add/AddWorkout';
import {useUnfinishedWorkout} from '../../../../app/redux/Workout/use/useUnfinishedWorkout';
import {useAllLastWorkouts} from '../../../../app/redux/Workout/use/useAllLastWorkouts';
import {useLastFinishedWorkout} from '../../../../app/redux/Workout/use/useLastFinishedWorkout';
import {dispatchAddWorkout} from '../../../../app/redux/Workout/dispatch/dispatchAddWorkout';
import {dispatchAddOrUpdateSetInWorkout} from '../../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {dispatchFinalizeWorkout} from '../../../../app/redux/Workout/dispatch/dispatchFinalizeWorkout';
import {dispatchDeleteSetFromWorkout} from '../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchSuggest} from '../../../../app/redux/Workout/dispatch/dispatchSuggest';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

const mockAddWorkoutSpy = jest.fn();
const mockAddOrUpdateSetSpy = jest.fn();
const mockFinalizeWorkoutSpy = jest.fn();
const mockDeleteSetSpy = jest.fn();
const mockSuggestSpy = jest.fn();

const mockNewSetPayload: WorkoutSet = {
  reps: 5,
  rir: 1,
  weight: 100,
  date: new Date('2024-05-01T00:00:00.000Z'),
};

jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/use/useAllLastWorkouts', () => ({
  useAllLastWorkouts: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/use/useLastFinishedWorkout', () => ({
  useLastFinishedWorkout: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchAddWorkout', () => ({
  dispatchAddWorkout: jest.fn(() => mockAddWorkoutSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout', () => ({
  dispatchAddOrUpdateSetInWorkout: jest.fn(() => mockAddOrUpdateSetSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchFinalizeWorkout', () => ({
  dispatchFinalizeWorkout: jest.fn(() => mockFinalizeWorkoutSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout', () => ({
  dispatchDeleteSetFromWorkout: jest.fn(() => mockDeleteSetSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchSuggest', () => ({
  dispatchSuggest: jest.fn(() => mockSuggestSpy),
}));

jest.mock('../../../../app/components/Workout/add/AddWorkoutSet', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({onSubmit, onDelete, workoutSet}: {onSubmit: (set: WorkoutSet) => void; onDelete?: () => void; workoutSet?: WorkoutSet}) => (
    <View>
      <TouchableOpacity
        testID={workoutSet ? `submit-existing-set-${workoutSet.index}` : 'submit-new-set'}
        onPress={() => {
          // Mirrors AddWorkoutSet: an existing row submits with its own index,
          // the new-set input submits without one.
          onSubmit(workoutSet ? {...mockNewSetPayload, index: workoutSet.index} : mockNewSetPayload);
        }}
      >
        <Text>{workoutSet ? 'Submit Existing Set' : 'Submit New Set'}</Text>
      </TouchableOpacity>
      {onDelete ? (
        <TouchableOpacity testID={`delete-existing-set-${workoutSet?.index}`} onPress={onDelete}>
          <Text>Delete Existing Set</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => []),
  useDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../app/components/video/VideoSelectionModal', () => () => null);

jest.mock('../../../../app/redux/VideoAnalysis/dispatch/dispatchLinkVideoAnalysisToWorkout', () => ({
  dispatchLinkVideoAnalysisToWorkout: jest.fn(() => jest.fn()),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');

  return {
    Button: ({children, onPress, disabled}: {children: React.ReactNode; onPress?: () => void; disabled?: boolean}) => (
      <TouchableOpacity
        testID={`button-${String(children).replace(/\s+/g, '-')}`}
        accessibilityState={{disabled: !!disabled}}
        onPress={() => {
          if (!disabled && onPress) {
            onPress();
          }
        }}
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({colors: {primary: '#000000', onPrimary: '#ffffff'}}),
  };
});

const mockedUseUnfinishedWorkout = jest.mocked(useUnfinishedWorkout);
const mockedUseAllLastWorkouts = jest.mocked(useAllLastWorkouts);
const mockedUseLastFinishedWorkout = jest.mocked(useLastFinishedWorkout);
const mockedDispatchAddWorkout = jest.mocked(dispatchAddWorkout);
const mockedDispatchAddOrUpdateSetInWorkout = jest.mocked(dispatchAddOrUpdateSetInWorkout);
const mockedDispatchFinalizeWorkout = jest.mocked(dispatchFinalizeWorkout);
const mockedDispatchDeleteSetFromWorkout = jest.mocked(dispatchDeleteSetFromWorkout);
const mockedDispatchSuggest = jest.mocked(dispatchSuggest);

describe('AddWorkout', () => {
  const date = new Date('2024-02-03T00:00:00.000Z');
  const exercise: Exercise = {id: 7, name: 'Bench Press'};

  beforeEach(() => {
    mockedUseAllLastWorkouts.mockReturnValue([]);
    mockedUseLastFinishedWorkout.mockReturnValue(undefined);
    mockedUseUnfinishedWorkout.mockReturnValue(undefined);
    mockedDispatchAddWorkout.mockClear();
    mockedDispatchAddOrUpdateSetInWorkout.mockClear();
    mockedDispatchFinalizeWorkout.mockClear();
    mockedDispatchDeleteSetFromWorkout.mockClear();
    mockedDispatchSuggest.mockClear();
    mockAddWorkoutSpy.mockReset();
    mockAddOrUpdateSetSpy.mockReset();
    mockFinalizeWorkoutSpy.mockReset();
    mockDeleteSetSpy.mockReset();
    mockSuggestSpy.mockReset();
  });

  it('creates a new workout when no unfinished workout exists', () => {
    const onSubmit = jest.fn();

    const {getByTestId} = render(<AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} />);

    fireEvent.press(getByTestId('submit-new-set'));

    const expectedWorkout: Workout = {
      sets: [{...mockNewSetPayload, index: 1}],
      notes: '',
      exerciseId: 7,
      trainingsId: 3,
      start: date,
    };

    expect(mockAddWorkoutSpy).toHaveBeenCalledTimes(1);
    expect(mockAddWorkoutSpy).toHaveBeenCalledWith(expectedWorkout, 3);
  });

  it('appends next set index when unfinished workout has no id', () => {
    const onSubmit = jest.fn();
    const unfinishedWorkout: Workout = {
      sets: [
        {index: 1, reps: 4, rir: 1, weight: 90},
        {index: 3, reps: 2, rir: 0, weight: 110},
      ],
      notes: '',
      exerciseId: 7,
      trainingsId: 3,
      start: date,
    };
    mockedUseUnfinishedWorkout.mockReturnValue(unfinishedWorkout);

    const {getByTestId} = render(<AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} />);

    fireEvent.press(getByTestId('submit-new-set'));

    const expectedWorkout: Workout = {
      sets: [{...mockNewSetPayload, index: 4}],
      notes: '',
      exerciseId: 7,
      trainingsId: 3,
      start: date,
    };

    expect(mockAddWorkoutSpy).toHaveBeenCalledTimes(1);
    expect(mockAddWorkoutSpy).toHaveBeenCalledWith(expectedWorkout, 3);
  });

  it('updates an existing unfinished workout when id is present', () => {
    const onSubmit = jest.fn();
    const unfinishedWorkout: Workout = {
      id: 99,
      sets: [{index: 1, reps: 4, rir: 1, weight: 90}],
      notes: '',
      exerciseId: 7,
      trainingsId: 3,
      start: date,
    };
    mockedUseUnfinishedWorkout.mockReturnValue(unfinishedWorkout);

    const {getByTestId} = render(<AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} />);

    fireEvent.press(getByTestId('submit-new-set'));

    expect(mockAddOrUpdateSetSpy).toHaveBeenCalledTimes(1);
    expect(mockAddOrUpdateSetSpy).toHaveBeenCalledWith(mockNewSetPayload, unfinishedWorkout);
  });

  it('disables finalize button without persisted unfinished workout and finalizes when available', () => {
    const onSubmitWithoutWorkout = jest.fn();
    const {getByTestId, rerender} = render(<AddWorkout exercise={exercise} onSubmit={onSubmitWithoutWorkout} trainingsId={3} date={date} />);

    expect(getByTestId('button-Add-Workout')).toBeDisabled();

    const onSubmitWithWorkout = jest.fn();
    const persistedWorkout: Workout = {
      id: 42,
      sets: [{index: 1, reps: 5, rir: 2, weight: 95}],
      notes: '',
      exerciseId: 7,
      trainingsId: 3,
      start: date,
    };
    mockedUseUnfinishedWorkout.mockReturnValue(persistedWorkout);

    rerender(<AddWorkout exercise={exercise} onSubmit={onSubmitWithWorkout} trainingsId={3} date={date} />);

    expect(getByTestId('button-Add-Workout')).toBeEnabled();
    fireEvent.press(getByTestId('button-Add-Workout'));

    expect(mockFinalizeWorkoutSpy).toHaveBeenCalledTimes(1);
    expect(mockFinalizeWorkoutSpy).toHaveBeenCalledWith(date, 42);
    expect(onSubmitWithWorkout).toHaveBeenCalledTimes(1);
  });

  it('reports the previous FINISHED workout 1RM via oneRepMaxRef, ignoring an in-progress workout (GH-195 P1 regression)', () => {
    // Spec: "Last training" baseline must point to the previous finished
    // workout — never the in-progress one. Simulate a previous training
    // (5×100, 1RM≈115.6) and a current in-progress training already showing
    // a heavier set (5×110, 1RM≈127.2) in useAllLastWorkouts. The card MUST
    // still read ~115.6, not ~127.2.
    const finishedWorkout: Workout = {
      id: 100,
      sets: [{index: 1, reps: 5, rir: 0, weight: 100}],
      notes: '',
      exerciseId: 7,
      start: new Date('2024-01-01T00:00:00.000Z'),
      end: new Date('2024-01-01T01:00:00.000Z'),
    };
    const inProgressWorkout: Workout = {
      id: 200,
      sets: [{index: 1, reps: 5, rir: 0, weight: 110}],
      notes: '',
      exerciseId: 7,
      start: new Date('2024-02-01T00:00:00.000Z'),
    };
    mockedUseAllLastWorkouts.mockReturnValue([inProgressWorkout]);
    mockedUseLastFinishedWorkout.mockReturnValue(finishedWorkout);
    mockedUseUnfinishedWorkout.mockReturnValue(inProgressWorkout);

    const oneRepMaxRef = jest.fn();
    render(
      <AddWorkout
        exercise={exercise}
        onSubmit={jest.fn()}
        trainingsId={3}
        date={date}
        oneRepMaxRef={oneRepMaxRef}
      />,
    );

    expect(oneRepMaxRef).toHaveBeenCalled();
    const reportedOneRm = oneRepMaxRef.mock.calls[oneRepMaxRef.mock.calls.length - 1][0];
    // 100 * (1 + 5/30) ≈ 116.67. We assert "previous finished" range, not the
    // in-progress 110-based value (~128.3) which would indicate the bug.
    expect(reportedOneRm).toBeGreaterThan(110);
    expect(reportedOneRm).toBeLessThan(120);
  });

  it('hides Done button when workout.end is defined and allowRefinalizeWhenDone is not set (normal mode)', () => {
    const finalizedWorkout: Workout = {
      id: 77,
      sets: [{index: 1, reps: 5, rir: 1, weight: 100, date: date}],
      notes: '',
      exerciseId: 7,
      start: date,
      end: date,
    };

    const {queryByTestId} = render(
      <AddWorkout exercise={exercise} onSubmit={jest.fn()} trainingsId={3} date={date} workout={finalizedWorkout} />,
    );

    expect(queryByTestId('button-Add-Workout')).toBeNull();
  });

  it('shows Done button when workout.end is defined and allowRefinalizeWhenDone=true (GH-323 edit mode regression)', () => {
    const finalizedWorkout: Workout = {
      id: 77,
      sets: [{index: 1, reps: 5, rir: 1, weight: 100, date: date}],
      notes: '',
      exerciseId: 7,
      start: date,
      end: date,
    };
    mockedUseUnfinishedWorkout.mockReturnValue(finalizedWorkout);

    const {getByTestId} = render(
      <AddWorkout exercise={exercise} onSubmit={jest.fn()} trainingsId={3} date={date} workout={finalizedWorkout} allowRefinalizeWhenDone />,
    );

    expect(getByTestId('button-Add-Workout')).toBeTruthy();
    expect(getByTestId('button-Add-Workout')).toBeEnabled();
  });

  it('does NOT re-finalize an already-ended workout when Done is pressed in edit mode (GH-323 P2-b regression)', () => {
    // Editing a finished historical training: pressing "Done" on an exercise whose
    // workout.end is already set must be pure navigation. Re-dispatching
    // FINALIZE_WORKOUT here would overwrite the existing `end` with the current
    // date, corrupting the workout's completion time/history ordering.
    const finalizedWorkout: Workout = {
      id: 77,
      sets: [{index: 1, reps: 5, rir: 1, weight: 100, date: date}],
      notes: '',
      exerciseId: 7,
      start: new Date('2024-01-01T00:00:00.000Z'),
      end: new Date('2024-01-01T01:00:00.000Z'),
    };
    mockedUseUnfinishedWorkout.mockReturnValue(finalizedWorkout);

    const onSubmit = jest.fn();
    const {getByTestId} = render(
      <AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} workout={finalizedWorkout} allowRefinalizeWhenDone />,
    );

    fireEvent.press(getByTestId('button-Add-Workout'));

    expect(mockFinalizeWorkoutSpy).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('still finalizes a not-yet-ended workout when Done is pressed in edit mode (GH-323 P2-b, unaffected case)', () => {
    const unfinishedWorkout: Workout = {
      id: 88,
      sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
      notes: '',
      exerciseId: 7,
      start: date,
    };
    mockedUseUnfinishedWorkout.mockReturnValue(unfinishedWorkout);

    const onSubmit = jest.fn();
    const {getByTestId} = render(
      <AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} allowRefinalizeWhenDone />,
    );

    fireEvent.press(getByTestId('button-Add-Workout'));

    expect(mockFinalizeWorkoutSpy).toHaveBeenCalledTimes(1);
    expect(mockFinalizeWorkoutSpy).toHaveBeenCalledWith(date, 88);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('handles suggest button enablement and dispatch', () => {
    const onSubmit = jest.fn();
    mockedUseAllLastWorkouts.mockReturnValue([
      {
        id: 500,
        sets: [{index: 1, reps: 3, rir: 1, weight: 120}],
        notes: '',
        exerciseId: 7,
        start: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);

    const {getByTestId, rerender} = render(<AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} suggest />);

    expect(getByTestId('button-Suggest-Workout')).toBeEnabled();
    fireEvent.press(getByTestId('button-Suggest-Workout'));
    expect(mockSuggestSpy).toHaveBeenCalledTimes(1);
    expect(mockSuggestSpy).toHaveBeenCalledWith(7);

    mockedUseAllLastWorkouts.mockReturnValue([]);
    rerender(<AddWorkout exercise={exercise} onSubmit={onSubmit} trainingsId={3} date={date} suggest />);

    expect(getByTestId('button-Suggest-Workout')).toBeDisabled();
  });

  // GH-63 round 2 (PR #429 review): during a planned training the merged
  // unfinished workout contains the planned-but-unlogged sets as pending rows.
  // Counting them made the header announce a set the user has not reached yet
  // ("Set 3" with 2 planned and 0 logged).
  describe('nextSetIndex', () => {
    const setNumberOf = (element: any) => element.props.children as string;

    it('counts sets in play when the caller knows no better (unchanged behaviour)', () => {
      mockedUseUnfinishedWorkout.mockReturnValue({
        sets: [
          {index: 1, reps: 4, rir: 1, weight: 90},
          {index: 2, reps: 4, rir: 1, weight: 90},
        ],
        notes: '',
        exerciseId: 7,
        start: date,
      });

      const {getByTestId} = render(<AddWorkout exercise={exercise} onSubmit={jest.fn()} trainingsId={3} date={date} />);

      expect(setNumberOf(getByTestId('add-workout-set-number'))).toEqual(' Set 3');
    });

    it('announces the set number the caller passed instead', () => {
      mockedUseUnfinishedWorkout.mockReturnValue({
        sets: [
          {index: 1, reps: 4, rir: 1, weight: 90},
          {index: 2, reps: 4, rir: 1, weight: 90},
        ],
        notes: '',
        exerciseId: 7,
        start: date,
      });

      const {getByTestId} = render(<AddWorkout exercise={exercise} onSubmit={jest.fn()} trainingsId={3} date={date} nextSetIndex={1} />);

      expect(setNumberOf(getByTestId('add-workout-set-number'))).toEqual(' Set 1');
    });

    it('stamps the announced number on the set that is created, so the logged set IS the announced one', () => {
      const unfinishedWorkout: Workout = {
        sets: [
          {index: 1, reps: 4, rir: 1, weight: 90},
          {index: 2, reps: 4, rir: 1, weight: 90},
        ],
        notes: '',
        exerciseId: 7,
        trainingsId: 3,
        start: date,
      };
      mockedUseUnfinishedWorkout.mockReturnValue(unfinishedWorkout);

      const onSubmitSet = jest.fn();
      const {getByTestId} = render(
        <AddWorkout exercise={exercise} onSubmit={jest.fn()} onSubmitSet={onSubmitSet} trainingsId={3} date={date} nextSetIndex={1} />,
      );

      fireEvent.press(getByTestId('submit-new-set'));

      // Without the stamp the reducer fallback would have produced index 3.
      expect(mockAddWorkoutSpy).toHaveBeenCalledWith(
        {
          sets: [{...mockNewSetPayload, index: 1}],
          notes: '',
          exerciseId: 7,
          trainingsId: 3,
          start: date,
        },
        3,
      );
      expect(onSubmitSet).toHaveBeenCalledWith({...mockNewSetPayload, index: 1});
    });

    it('never overrides the index of an existing row that is submitted', () => {
      const unfinishedWorkout: Workout = {
        id: 99,
        sets: [{index: 2, reps: 4, rir: 1, weight: 90}],
        notes: '',
        exerciseId: 7,
        trainingsId: 3,
        start: date,
      };
      mockedUseUnfinishedWorkout.mockReturnValue(unfinishedWorkout);

      const {getByTestId} = render(<AddWorkout exercise={exercise} onSubmit={jest.fn()} trainingsId={3} date={date} nextSetIndex={5} />);

      fireEvent.press(getByTestId('submit-existing-set-2'));

      expect(mockAddOrUpdateSetSpy).toHaveBeenCalledWith({...mockNewSetPayload, index: 2}, unfinishedWorkout);
    });
  });
});
