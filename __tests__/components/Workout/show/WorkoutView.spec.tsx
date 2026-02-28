import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import WorkoutView from '../../../../app/components/Workout/show/WorkoutView';
import {useWorkoutById} from '../../../../app/redux/Workout/use/useWorkoutById';
import {useExercise} from '../../../../app/redux/Exercises/use/useExercise';
import dispatchDeleteWorkout from '../../../../app/redux/Workout/dispatch/dispatchDeleteWorkout';
import {dispatchDeleteSetFromWorkout} from '../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchAddOrUpdateSetInWorkout} from '../../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {Workout} from '../../../../app/models/entities/Workout';

const mockDeleteWorkoutSpy = jest.fn();
const mockDeleteSetSpy = jest.fn();
const mockAddOrUpdateSetSpy = jest.fn();

jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(),
}));

jest.mock('../../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchDeleteWorkout', () => jest.fn(() => mockDeleteWorkoutSpy));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchDeleteSetFromWorkout', () => ({
  dispatchDeleteSetFromWorkout: jest.fn(() => mockDeleteSetSpy),
}));

jest.mock('../../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout', () => ({
  dispatchAddOrUpdateSetInWorkout: jest.fn(() => mockAddOrUpdateSetSpy),
}));

jest.mock('../../../../app/components/Workout/add/AddWorkoutSet', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');

  return ({onSubmit}: {onSubmit: (set: {index: number; reps: number; rir: number; weight: number}) => void}) => (
    <TouchableOpacity
      testID="add-workout-set-submit"
      onPress={() => {
        onSubmit({index: 99, reps: 8, rir: 2, weight: 85});
      }}
    >
      <Text>AddWorkoutSet Submit</Text>
    </TouchableOpacity>
  );
});

jest.mock('../../../../app/components/Workout/show/WorkoutSetView', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({onDelete, onSubmit, editable}: {onDelete: (set: {index: number; reps: number; rir: number; weight: number}) => void; onSubmit: (set: {index: number; reps: number; rir: number; weight: number}) => void; editable?: boolean}) => (
    <View>
      <Text testID="workout-set-view-editable">editable-{String(!!editable)}</Text>
      <TouchableOpacity
        testID="set-view-submit"
        onPress={() => {
          onSubmit({index: 1, reps: 5, rir: 1, weight: 100});
        }}
      >
        <Text>SetView Submit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="set-view-delete"
        onPress={() => {
          onDelete({index: 1, reps: 5, rir: 1, weight: 100});
        }}
      >
        <Text>SetView Delete</Text>
      </TouchableOpacity>
    </View>
  );
});

jest.mock('react-native-outside-press', () => {
  const React = require('react');
  const {TouchableOpacity, View, Text} = require('react-native');

  return ({children, onOutsidePress}: {children: React.ReactNode; onOutsidePress: () => void}) => (
    <View>
      <TouchableOpacity testID="outside-press" onPress={onOutsidePress}>
        <Text>Outside</Text>
      </TouchableOpacity>
      {children}
    </View>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return {
    Card: ({children, onLongPress}: {children: React.ReactNode; onLongPress?: () => void}) => (
      <TouchableOpacity testID="workout-card" onLongPress={onLongPress}>
        <View>{children}</View>
      </TouchableOpacity>
    ),
    IconButton: ({icon, onPress}: {icon: string; onPress?: () => void}) => (
      <TouchableOpacity testID={`icon-button-${icon}`} onPress={onPress}>
        <Text>{icon}</Text>
      </TouchableOpacity>
    ),
    Text: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
    useTheme: () => ({fonts: {titleMedium: {fontSize: 16}}}),
  };
});

const mockedUseWorkoutById = jest.mocked(useWorkoutById);
const mockedUseExercise = jest.mocked(useExercise);
const mockedDispatchDeleteWorkout = jest.mocked(dispatchDeleteWorkout);
const mockedDispatchDeleteSetFromWorkout = jest.mocked(dispatchDeleteSetFromWorkout);
const mockedDispatchAddOrUpdateSetInWorkout = jest.mocked(dispatchAddOrUpdateSetInWorkout);

describe('WorkoutView', () => {
  const workout: Workout = {
    id: 10,
    exerciseId: 3,
    sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
    notes: '',
    records: {'1RM': 120},
  };

  beforeEach(() => {
    mockedUseWorkoutById.mockReturnValue(workout);
    mockedUseExercise.mockReturnValue({id: 3, name: 'Squat'});
    mockedDispatchDeleteWorkout.mockClear();
    mockedDispatchDeleteSetFromWorkout.mockClear();
    mockedDispatchAddOrUpdateSetInWorkout.mockClear();
    mockDeleteWorkoutSpy.mockReset();
    mockDeleteSetSpy.mockReset();
    mockAddOrUpdateSetSpy.mockReset();
  });

  it('enters edit mode on long press when editable is true', () => {
    const {getByTestId, queryByTestId} = render(<WorkoutView workoutId={10} editable />);

    expect(queryByTestId('icon-button-delete')).toBeNull();
    fireEvent(getByTestId('workout-card'), 'longPress');

    expect(getByTestId('icon-button-delete')).toBeTruthy();
    expect(getByTestId('add-workout-set-submit')).toBeTruthy();
  });

  it('deletes workout from edit mode', () => {
    const {getByTestId, queryByTestId} = render(<WorkoutView workoutId={10} editable />);

    fireEvent(getByTestId('workout-card'), 'longPress');
    fireEvent.press(getByTestId('icon-button-delete'));

    expect(mockDeleteWorkoutSpy).toHaveBeenCalledTimes(1);
    expect(mockDeleteWorkoutSpy).toHaveBeenCalledWith(workout);
    expect(queryByTestId('icon-button-delete')).toBeNull();
  });

  it('wires add and update set actions to dispatcher', () => {
    const {getByTestId} = render(<WorkoutView workoutId={10} editable />);

    fireEvent(getByTestId('workout-card'), 'longPress');
    fireEvent.press(getByTestId('add-workout-set-submit'));
    fireEvent.press(getByTestId('set-view-submit'));

    expect(mockAddOrUpdateSetSpy).toHaveBeenNthCalledWith(1, {index: 99, reps: 8, rir: 2, weight: 85}, workout);
    expect(mockAddOrUpdateSetSpy).toHaveBeenNthCalledWith(2, {index: 1, reps: 5, rir: 1, weight: 100}, workout);
  });

  it('does not enter edit mode when editable is false', () => {
    const {getByTestId, queryByTestId} = render(<WorkoutView workoutId={10} editable={false} />);

    fireEvent(getByTestId('workout-card'), 'longPress');

    expect(queryByTestId('icon-button-delete')).toBeNull();
    expect(queryByTestId('add-workout-set-submit')).toBeNull();
    expect(getByTestId('workout-set-view-editable').props.children).toEqual(['editable-', 'false']);
  });
});
