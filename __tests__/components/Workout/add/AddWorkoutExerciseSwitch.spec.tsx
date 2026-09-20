import React from 'react';
import {Keyboard} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import AddWorkout from '../../../../app/components/Workout/add/AddWorkout';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

/**
 * GH-428 (H4): switching the exercise inside a running training used to leave the
 * previous exercise's numbers in the input row. The one-tap "Add" that logs a
 * repeat set then wrote those numbers against the NEW exercise.
 *
 * This renders the REAL AddWorkoutSet (not the stub the other AddWorkout spec
 * uses) — the defect lives in that component's local draft state, so a mocked
 * input row cannot see it.
 */

const mockAddWorkoutSpy = jest.fn();
const mockAddOrUpdateSetSpy = jest.fn();

jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(() => undefined),
  usePersistedUnfinishedWorkout: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/Workout/use/useAllLastWorkouts', () => ({
  useAllLastWorkouts: jest.fn(() => []),
}));

jest.mock('../../../../app/redux/Workout/use/useLastFinishedWorkout', () => ({
  useLastFinishedWorkout: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchAddWorkout', () => ({
  dispatchAddWorkout: jest.fn(() => mockAddWorkoutSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout', () => ({
  dispatchAddOrUpdateSetInWorkout: jest.fn(() => mockAddOrUpdateSetSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchFinalizeWorkout', () => ({
  dispatchFinalizeWorkout: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout', () => ({
  dispatchDeleteSetFromWorkout: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchSuggest', () => ({
  dispatchSuggest: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(() => ({toggles: {disable1RMButton: true, disableToasts: true}})),
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => []),
  shallowEqual: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({show: jest.fn()}));

jest.mock('../../../../app/components/video/VideoSelectionModal', () => () => null);

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');
  return {
    Button: ({children, onPress, testID, disabled}: any) => (
      <TouchableOpacity testID={testID ?? `button-${children}`} onPress={disabled ? undefined : onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Icon: () => null,
    IconButton: ({icon, onPress, testID}: any) => (
      <TouchableOpacity testID={testID ?? `icon-button-${icon}`} onPress={onPress}>
        <Text>{icon}</Text>
      </TouchableOpacity>
    ),
    Text: ({children}: any) => <Text>{children}</Text>,
    TextInput: ({label, onChangeText, ...rest}: any) => <TextInput accessibilityLabel={label} onChangeText={onChangeText} {...rest} />,
    ToggleButton: ({onPress}: any) => (
      <TouchableOpacity testID="toggle-button" onPress={onPress}>
        <Text>1RM</Text>
      </TouchableOpacity>
    ),
    Tooltip: ({children}: any) => <View>{children}</View>,
    useTheme: () => ({colors: {primary: '#000000', onPrimary: '#ffffff', secondary: '#888888'}}),
  };
});

const bench = {id: 1, name: 'Bankdrücken'} satisfies Exercise;
const squat = {id: 2, name: 'Squat'} satisfies Exercise;

/** The training date is fixed so the written set can be asserted as a whole object. */
const WORKOUT_DATE = new Date('2026-03-01T10:00:00.000Z');
const TRAININGS_ID = 5;

/**
 * The complete workout the audit's "Bankdrücken 8 × 60 kg" is expected to write.
 * Asserted as a whole — a regression in `rir`, `index`, `trainingsId`, `notes` or
 * the set's timestamp has to fail the test, not slip past a partial match.
 */
const benchWorkoutOf8x60 = {
  sets: [{index: 1, rir: 0, reps: 8, weight: 60, date: WORKOUT_DATE}],
  notes: '',
  exerciseId: bench.id,
  trainingsId: TRAININGS_ID,
  start: WORKOUT_DATE,
} satisfies Workout;

const renderFor = (exercise: Exercise) => {
  const onSubmitSet = jest.fn();
  const utils = render(<AddWorkout exercise={exercise} onSubmit={jest.fn()} date={WORKOUT_DATE} trainingsId={TRAININGS_ID} onSubmitSet={onSubmitSet} />);
  return {...utils, onSubmitSet};
};

const rerenderFor = (rerender: (ui: React.ReactElement) => void, exercise: Exercise, onSubmitSet: jest.Mock) => {
  rerender(<AddWorkout exercise={exercise} onSubmit={jest.fn()} date={WORKOUT_DATE} trainingsId={TRAININGS_ID} onSubmitSet={onSubmitSet} />);
};

describe('AddWorkout — GH-428 (H4) exercise switch clears the input row', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  });

  it('does not carry the previous exercise numbers into the new exercise', () => {
    const {getByTestId, rerender, onSubmitSet} = renderFor(bench);

    // Log Bankdrücken 8 x 60 kg, exactly the audit's case.
    fireEvent.changeText(getByTestId('add-workout-set-reps-input'), '8');
    fireEvent.changeText(getByTestId('add-workout-set-rir-input'), '0');
    fireEvent.changeText(getByTestId('add-workout-set-weight-input'), '60');
    fireEvent.press(getByTestId('add-workout-set-submit-button'));

    expect(mockAddWorkoutSpy).toHaveBeenCalledWith(benchWorkoutOf8x60, TRAININGS_ID);

    rerenderFor(rerender, squat, onSubmitSet);

    expect(getByTestId('add-workout-set-reps-input').props.value).toBe('');
    expect(getByTestId('add-workout-set-weight-input').props.value).toBe('');
  });

  it('an "Add" tap right after the switch writes no set at all', () => {
    const {getByTestId, rerender, onSubmitSet} = renderFor(bench);

    fireEvent.changeText(getByTestId('add-workout-set-reps-input'), '8');
    fireEvent.changeText(getByTestId('add-workout-set-rir-input'), '0');
    fireEvent.changeText(getByTestId('add-workout-set-weight-input'), '60');
    fireEvent.press(getByTestId('add-workout-set-submit-button'));
    mockAddWorkoutSpy.mockClear();
    onSubmitSet.mockClear();

    rerenderFor(rerender, squat, onSubmitSet);
    fireEvent.press(getByTestId('add-workout-set-submit-button'));

    expect(onSubmitSet).not.toHaveBeenCalled();
    expect(mockAddWorkoutSpy).not.toHaveBeenCalled();
  });

  it('keeps the draft while the exercise stays the same', () => {
    const {getByTestId, rerender, onSubmitSet} = renderFor(bench);

    fireEvent.changeText(getByTestId('add-workout-set-reps-input'), '8');
    rerenderFor(rerender, bench, onSubmitSet);

    expect(getByTestId('add-workout-set-reps-input').props.value).toBe('8');
  });

  it('reports the cleared row to the live-input listener after the switch', () => {
    const onLiveInputChange = jest.fn();
    const props = (exercise: Exercise) => (
      <AddWorkout
        exercise={exercise}
        onSubmit={jest.fn()}
        date={new Date('2026-03-01T10:00:00.000Z')}
        trainingsId={5}
        onLiveInputChange={onLiveInputChange}
      />
    );
    const {getByTestId, rerender} = render(props(bench));

    fireEvent.changeText(getByTestId('add-workout-set-reps-input'), '8');
    fireEvent.changeText(getByTestId('add-workout-set-weight-input'), '60');
    onLiveInputChange.mockClear();

    rerender(props(squat));

    expect(onLiveInputChange).toHaveBeenLastCalledWith({reps: 0, rir: 0, weight: 0});
  });
});
