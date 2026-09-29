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
jest.mock('../../../../app/components/Training/analyse/MicroPlanOverview', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return ({micro}: any) => <Text testID="micro-plan-overview">{`micro-plan:${micro}`}</Text>;
});

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

  // GH-436: the micro-wide planned overview moved here from a training's analysis.
  it('offers Plan as a fourth position and renders the micro plan overview there', () => {
    const onViewModeChange = jest.fn();
    const {rerender} = render(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={3}
        viewMode="gesamt"
        onViewModeChange={onViewModeChange}
      />,
    );
    expect(screen.getByText('Plan')).toBeTruthy();
    expect(screen.queryByTestId('micro-plan-overview')).toBeNull();

    fireEvent.press(screen.getByTestId('seg-btn-plan'));
    expect(onViewModeChange).toHaveBeenCalledWith('plan');

    rerender(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={3}
        viewMode="plan"
        onViewModeChange={onViewModeChange}
      />,
    );
    expect(screen.getByTestId('seg-btn-plan').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('micro-plan-overview').props.children).toBe('micro-plan:3');
  });

  it('lists the positions in the order Gesamt, Exercise, Muscle, Plan', () => {
    render(
      <MicroOverviewTraining
        trainingsPlan={mockPlan}
        micro={1}
        viewMode="gesamt"
        onViewModeChange={jest.fn()}
      />,
    );
    const ids = screen.root.findAll((node) => typeof node.props?.testID === 'string' && node.props.testID.startsWith('seg-btn-')).map((node) => node.props.testID);
    expect([...new Set(ids)]).toEqual(['seg-btn-gesamt', 'seg-btn-exercise', 'seg-btn-muscle', 'seg-btn-plan']);
  });
});

describe('MicroOverviewTraining – PERF-003 the tapped view is marked selected at once', () => {
  const Owner = () => {
    const [mode, setMode] = React.useState<ViewMode>('gesamt');
    return <MicroOverviewTraining trainingsPlan={mockPlan} micro={1} viewMode={mode} onViewModeChange={setMode} />;
  };

  it('moves the selection to the tapped segment and keeps it once the owner has taken the value', () => {
    render(<Owner />);
    expect(screen.getByTestId('seg-btn-gesamt').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('seg-btn-muscle'));
    expect(screen.getByTestId('seg-btn-muscle').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('seg-btn-gesamt').props.accessibilityState.selected).toBe(false);
  });

  it('falls back to the owner value when the owner does not take the tapped one', () => {
    render(<MicroOverviewTraining trainingsPlan={mockPlan} micro={1} viewMode="gesamt" onViewModeChange={jest.fn()} />);
    fireEvent.press(screen.getByTestId('seg-btn-muscle'));
    expect(screen.getByTestId('seg-btn-gesamt').props.accessibilityState.selected).toBe(true);
  });
});
