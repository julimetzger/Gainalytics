import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import MicroOverviewTraining, {ViewMode} from '../../../../app/tabs/trainings/MicroOverviewTraining';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

jest.mock('../../../../app/redux/Training/use/useAllTrainingsInMicro', () => ({
  useAllTrainingsInMicro: () => [],
}));
jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: () => [],
}));
jest.mock('../../../../app/components/Training/analyse/MicroOverview', () => 'MicroOverview');
jest.mock('../../../../app/components/Training/analyse/MicroExerciseOverview', () => 'MicroExerciseOverview');
jest.mock('../../../../app/components/analyse/MetricsOverviewForWorkouts', () => 'MetricsOverviewForWorkouts');

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {TouchableOpacity, Text, View} = require('react-native');
  return {
    SegmentedButtons: ({value, onValueChange, buttons}: any) => (
      <View>
        {buttons.map((btn: any) => (
          <TouchableOpacity
            key={btn.value}
            testID={`seg-btn-${btn.value}`}
            accessibilityState={{selected: value === btn.value}}
            onPress={() => onValueChange(btn.value)}
          >
            <Text>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    Text: ({children}: any) => <Text>{children}</Text>,
  };
});

const mockPlan = {
  id: 1,
  name: 'Test Plan',
  trainings: {},
  trainingNames: {},
} satisfies TrainingsPlan;

describe('MicroOverviewTraining – viewMode prop control', () => {
  it('renders the view controlled by viewMode prop', () => {
    const onViewModeChange = jest.fn();
    render(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={1}
        viewMode="exercise"
        onViewModeChange={onViewModeChange}
      />,
    );
    expect(screen.getByTestId('seg-btn-exercise').props.accessibilityState.selected).toBe(true);
  });

  it('calls onViewModeChange when a button is pressed', () => {
    const onViewModeChange = jest.fn();
    render(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={1}
        viewMode="gesamt"
        onViewModeChange={onViewModeChange}
      />,
    );
    fireEvent.press(screen.getByTestId('seg-btn-exercise'));
    expect(onViewModeChange).toHaveBeenCalledWith('exercise');
  });

  it('state is retained when micro prop changes (parent controls viewMode)', () => {
    const onViewModeChange = jest.fn();
    // Parent sets viewMode='exercise' — simulates user having selected Exercise
    const {rerender} = render(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={1}
        viewMode="exercise"
        onViewModeChange={onViewModeChange}
      />,
    );
    // Swipe to next micro (micro=2) — parent still passes viewMode='exercise'
    rerender(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={2}
        viewMode="exercise"
        onViewModeChange={onViewModeChange}
      />,
    );
    expect(screen.getByTestId('seg-btn-exercise').props.accessibilityState.selected).toBe(true);
  });

  it('cold start defaults to gesamt when parent passes gesamt', () => {
    const onViewModeChange = jest.fn();
    render(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={1}
        viewMode="gesamt"
        onViewModeChange={onViewModeChange}
      />,
    );
    expect(screen.getByTestId('seg-btn-gesamt').props.accessibilityState.selected).toBe(true);
  });
});
