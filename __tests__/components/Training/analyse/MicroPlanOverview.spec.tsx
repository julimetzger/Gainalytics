import React from 'react';
import {render} from '@testing-library/react-native';
import MicroPlanOverview from '../../../../app/components/Training/analyse/MicroPlanOverview';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

const mockUseAllTrainingsInMicro = jest.fn();
const mockUseWorkoutsByIds = jest.fn();

jest.mock('../../../../app/redux/Training/use/useAllTrainingsInMicro', () => ({
  useAllTrainingsInMicro: (...args: unknown[]) => mockUseAllTrainingsInMicro(...args),
}));

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: (...args: unknown[]) => mockUseWorkoutsByIds(...args),
}));

jest.mock('../../../../app/components/Training/analyse/MicroMuscleMapCard', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  return ({trainingsPlanId, micro}: any) => (
    <View testID="micro-muscle-map-card-mock">
      <Text testID="muscle-card-args">{`${trainingsPlanId}/${micro}`}</Text>
    </View>
  );
});

jest.mock('../../../../app/components/Training/plan/PlanningOverview', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return ({micro}: any) => <Text testID="planning-overview-mock">{`planning:${micro}`}</Text>;
});

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {Text};
});

const PLAN = {id: 7, name: 'Push pull', trainings: {}, trainingNames: {1: 'Push'}} as unknown as TrainingsPlan;

const set = (weight: number, reps: number) => ({weight, reps});

describe('MicroPlanOverview (GH-417 Plan position)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('totals the planned sets of every training in the micro', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1, plannedWorkouts: {10: 100, 11: 101}}, {id: 2, plannedWorkouts: {12: 102}}]);
    mockUseWorkoutsByIds.mockReturnValue([
      {id: 100, sets: [set(100, 5), set(100, 5), set(100, 5)]},
      {id: 101, sets: [set(60, 8), set(60, 8)]},
      {id: 102, sets: [set(40, 12)]},
    ]);

    const {getByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={3} />);

    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([100, 101, 102]);
    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 6 (planned)');
  });

  it('shows the micro-wide planned muscle map and the planned metrics', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1, plannedWorkouts: {10: 100}}]);
    mockUseWorkoutsByIds.mockReturnValue([{id: 100, sets: [set(100, 5), set(100, 5)]}]);

    const {getByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={3} />);

    expect(getByTestId('muscle-card-args').props.children).toBe('7/3');
    expect(getByTestId('planning-overview-mock').props.children).toBe('planning:3');
  });

  it('stays a clean, readable screen for a micro without planned sets (AC6)', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1, plannedWorkouts: {}}]);
    mockUseWorkoutsByIds.mockReturnValue([]);

    const {getByTestId, queryByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={9} />);

    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 0 (planned)');
    expect(getByTestId('micro-plan-overview-empty')).toBeTruthy();
    // not an empty white area, and no table of zeroes either
    expect(queryByTestId('micro-muscle-map-card-mock')).toBeNull();
    expect(queryByTestId('planning-overview-mock')).toBeNull();
  });

  it('survives a micro whose trainings carry no plannedWorkouts key at all', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1}]);
    mockUseWorkoutsByIds.mockReturnValue([]);

    const {getByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={9} />);

    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([]);
    expect(getByTestId('micro-plan-overview-empty')).toBeTruthy();
  });
});
