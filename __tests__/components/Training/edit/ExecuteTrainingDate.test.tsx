import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ExecuteTraining from '../../../../app/components/Training/execute/ExecuteTraining';
import { TrainingsState } from '../../../../app/models/TrainingsState';
import { Provider as ReduxProvider } from 'react-redux';
import { Provider as PaperProvider } from 'react-native-paper';

// Fix ReferenceError: setImmediate is not defined
global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args)) as any;

// Mock gesture handler before anything else
jest.mock('react-native-gesture-handler', () => ({}));

const mockStore = {
  getState: () => ({
    workout: { allIds: [] },
    exercise: { allIds: [] },
  }),
  subscribe: () => () => {},
  dispatch: jest.fn(),
};

// Mock components and hooks
jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(() => ({ id: 1, start: new Date('2023-01-01T10:00:00Z'), end: new Date('2023-01-01T11:00:00Z'), sets: [] })),
}));
jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(() => 2),
}));
jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(() => undefined),
}));
jest.mock('../../../../app/redux/Workout/use/useAllLastWorkouts', () => ({
  useAllLastWorkouts: jest.fn(() => []),
}));
jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(() => ({ toggles: {} })),
}));

// Mock DatePicker
jest.mock('../../../../app/components/picker/date/DatePicker', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return ({ date, setDate }: any) => (
    <TouchableOpacity onPress={() => setDate(new Date('2023-01-02T10:00:00Z'))}>
      <Text testID="datepicker-text">{date.toISOString()}</Text>
    </TouchableOpacity>
  );
});

// Mock ExerciseHistory to avoid deep component tree issues
jest.mock('../../../../app/components/exercise/show/ExerciseHistory', () => 'ExerciseHistory');
jest.mock('../../../../app/components/Workout/show/WorkoutSetView', () => 'WorkoutSetView');
jest.mock('../../../../app/components/Workout/add/AddWorkout', () => 'AddWorkout');
jest.mock('../../../../app/components/Workout/add/AddWorkoutSet', () => 'AddWorkoutSet');

// Remove the problematic mock that causes "module not found"
// OneRepMaxOverview might be in a different path or not needed if we mock the whole parent
jest.mock('../../../../app/components/exercise/show/ExerciseHistory', () => 'ExerciseHistory');

describe('ExecuteTraining Date Selection', () => {
  const mockTraining = {
    id: 1,
    state: TrainingsState.FINISHED,
    doneWorkoutIds: { 10: 1 },
    plannedWorkouts: {},
    exercises: [10],
  };

  const mockExercise = {
    id: 10,
    name: 'Squat',
  };

  it('initializes date from doneWorkout and allows changing it', () => {
    const { getByTestId } = render(
      <ReduxProvider store={mockStore as any}>
        <PaperProvider>
          <ExecuteTraining
            training={mockTraining as any}
            chosenExercise={mockExercise as any}
            onSubmit={() => {}}
          />
        </PaperProvider>
      </ReduxProvider>
    );

    const dateText = getByTestId('datepicker-text');
    // Initial date should match the mock doneWorkout.start
    expect(dateText.props.children).toBe(new Date('2023-01-01T10:00:00Z').toISOString());

    // Simulate date change via mock DatePicker
    fireEvent.press(dateText);
    expect(dateText.props.children).toBe(new Date('2023-01-02T10:00:00Z').toISOString());
  });
});
