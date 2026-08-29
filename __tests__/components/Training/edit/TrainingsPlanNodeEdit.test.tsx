import React from 'react';
import {render, fireEvent, screen, waitFor} from '@testing-library/react-native';
import TrainingsPlanNode from '../../../../app/components/Training/TrainingsPlanNode';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

const mockDeleteTraining = jest.fn();

// Mock dependencies
jest.mock('../../../../app/redux/Training/use/useTrainingInTrainingsPlan', () => ({
  useTrainingInTrainingsPlan: (planId: number, micro: number, trainingInMicro: number) => {
    if (micro === 1) {
      return {
        id: 1,
        state: 'F', // TrainingsState.FINISHED
        exercises: [101],
        doneWorkoutIds: {'101': 1},
        plannedWorkouts: {'101': 2},
      };
    }
    return {
      id: 2,
      state: 'S', // TrainingsState.STARTED
      exercises: [101],
      doneWorkoutIds: {},
      plannedWorkouts: {},
    };
  },
}));

jest.mock('../../../../app/redux/Training/trainingsPlanReducer', () => ({
  getPreviousMicroInMeso: jest.fn(() => null),
}));

jest.mock('../../../../app/redux/Exercises/use/useExerciseByIds', () => ({
  useExerciseByIds: () => [{id: 101, name: 'Test Exercise'}],
}));

jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: () => undefined,
}));

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: () => ({toggles: {disableTimer: false}}),
}));

jest.mock('../../../../app/redux/Training/dispatch/plan/dispatchStartTraining', () => ({
  dispatchStartTraining: () => jest.fn(),
}));
jest.mock('../../../../app/redux/Training/dispatch/general/dispatchModifyExercisesInTraining', () => ({
  dispatchModifyExercisesInTraining: () => jest.fn(),
}));
jest.mock('../../../../app/redux/Training/dispatch/execute/dispatchFinishTraining', () => ({
  dispatchFinishTraining: () => jest.fn(),
}));
jest.mock('../../../../app/redux/Training/dispatch/general/dispatchDeleteTraining', () => ({
  dispatchDeleteTraining: () => mockDeleteTraining,
}));
jest.mock('../../../../app/redux/Training/dispatch/general/dispatchReplaceExerciseInTraining', () => ({
  dispatchReplaceExerciseInTraining: () => jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const DialogBase = ({visible, children}: any) => (visible ? <>{children}</> : null);
  DialogBase.Title = ({children}: any) => <Text>{children}</Text>;
  DialogBase.Content = ({children}: any) => <>{children}</>;
  DialogBase.Actions = ({children}: any) => <>{children}</>;
  return {
    Button: ({children, onPress}: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Dialog: DialogBase,
    Portal: ({children}: any) => <>{children}</>,
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    Menu: Object.assign(
      ({visible, children}: any) => (visible ? <View>{children}</View> : null),
      {
        Item: ({title, onPress, testID, disabled}: any) => (
          <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} disabled={!!disabled}>
            <Text>{typeof title === 'string' ? title : null}</Text>
          </TouchableOpacity>
        ),
      },
    ),
    useTheme: () => ({
      colors: {background: '#fff', primary: '#6200ee', onSurfaceVariant: '#888'},
      fonts: {bodyMedium: {fontSize: 14}, labelSmall: {fontSize: 11}},
    }),
  };
});

jest.mock('../../../../app/components/Training/execute/PauseDoneNotification', () => ({
  PauseDoneNotification: () => [jest.fn(), jest.fn()],
}));
jest.mock('../../../../app/components/Training/execute/FinishTrainingNotification', () => ({
  FinishTrainingNotification: () => [jest.fn(), jest.fn()],
}));
jest.mock('../../../../app/components/Training/ExerciseAlternativesDialog', () => 'ExerciseAlternativesDialog');
jest.mock('../../../../app/components/Training/execute/ExecuteTraining', () => {
  const {Text} = require('react-native');
  return () => <Text>ExecuteWorkoutInTraining</Text>;
});
jest.mock('../../../../app/components/Training/execute/EditTraining', () => {
  const {Text} = require('react-native');
  return () => <Text testID="edit-training-component">EditTraining</Text>;
});
jest.mock('../../../../app/components/picker/elements/TrainingElementPicker', () => 'TrainingElementPicker');
jest.mock('../../../../app/components/Training/DraggableExercise', () => 'DraggableExercise');
jest.mock('../../../../app/components/Training/execute/Timer', () => 'Timer');
jest.mock('../../../../app/components/Training/analyse/TrainingsOverview', () => {
  const {Text} = require('react-native');
  return () => <Text testID="trainings-overview">TrainingsOverview</Text>;
});
jest.mock('../../../../app/tabs/trainings/MicroOverviewTraining', () => {
  const {Text} = require('react-native');
  return () => <Text>MicroOverview</Text>;
});
jest.mock('../../../../app/components/Training/analyse/TrainingHistory', () => {
  const {Text} = require('react-native');
  return () => <Text testID="training-history">TrainingHistory</Text>;
});
jest.mock('../../../../app/components/Training/TrainingsBase', () => 'TrainingsBase');
jest.mock('../../../../app/components/Training/plan/PlanTraining', () => {
  const {Text} = require('react-native');
  return () => <Text testID="plan-workout">PlanWorkout</Text>;
});
jest.mock('../../../../app/components/Training/plan/PlanningOverview', () => 'PlanningOverview');
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  default: {show: jest.fn()},
}));

describe('TrainingsPlanNode - Edit Finished Training (via overflow)', () => {
  const mockPlan = {
    id: 1,
    name: 'Test Plan',
    trainings: {},
    trainingNames: {0: 'Day 1'},
  } satisfies TrainingsPlan;

  const baseProps = {
    trainingsPlan: mockPlan,
    micro: 1,
    trainingInMicro: 0,
    showDone: false,
    setIgnoreSwipe: jest.fn(),
    overflowVisible: false,
    onCloseOverflow: jest.fn(),
  };

  it('defaults to Analysis tab for FINISHED training', () => {
    render(<TrainingsPlanNode {...baseProps} />);
    expect(screen.getByTestId('trainings-overview')).toBeTruthy();
  });

  it('shows TrainingHistory on Train tab for FINISHED training', () => {
    render(<TrainingsPlanNode {...baseProps} />);
    fireEvent.press(screen.getByTestId('subtab-train'));
    expect(screen.getByTestId('training-history')).toBeTruthy();
  });

  it('shows Edit training item in overflow when overflowVisible=true', () => {
    render(<TrainingsPlanNode {...baseProps} overflowVisible={true} />);
    expect(screen.getByTestId('overflow-edit')).toBeTruthy();
  });

  it('pressing Edit training in overflow switches to Train tab with EditTraining', async () => {
    render(<TrainingsPlanNode {...baseProps} overflowVisible={true} />);
    fireEvent.press(screen.getByTestId('overflow-edit'));
    await waitFor(() => {
      expect(screen.getByTestId('edit-training-component')).toBeTruthy();
    });
  });

  it('deletes training after Delete + confirmation in dialog', async () => {
    render(<TrainingsPlanNode {...baseProps} overflowVisible={true} />);
    fireEvent.press(screen.getByTestId('overflow-discard'));
    await waitFor(() => {
      expect(screen.getByText('Delete Training')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Delete'));
    expect(mockDeleteTraining).toHaveBeenCalledWith({
      trainingsPlanId: 1,
      trainingsId: 1,
      micro: 1,
      trainingInMicro: 0,
      workoutIds: expect.any(Array),
    });
  });
});
