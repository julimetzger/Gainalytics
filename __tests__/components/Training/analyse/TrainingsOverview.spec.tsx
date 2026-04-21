import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingsOverview from '../../../../app/components/Training/analyse/TrainingsOverview';
import {TrainingsState} from '../../../../app/models/TrainingsState';

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(() => []),
}));

jest.mock('../../../../app/utils/AnalyseUtils', () => ({
  calculateMetricComparisons: jest.fn(() => new Map()),
}));

jest.mock('../../../../app/components/analyse/MetricsOverviewForWorkouts', () => {
  const {View} = require('react-native');
  return () => <View />;
});

jest.mock('../../../../app/components/analyse/MetricComparison', () => {
  const {Text} = require('react-native');
  return ({comparison}: any) => <Text>{comparison?.current ?? 0}</Text>;
});

jest.mock('../../../../app/components/Training/useVelocityLossInsights', () => ({
  useVelocityLossInsights: jest.fn(),
}));

jest.mock('../../../../app/components/Training/VelocityLossInsightCard', () => {
  const {Text} = require('react-native');
  return ({exerciseName}: {exerciseName: string}) => <Text testID="vl-insight-card">{exerciseName}</Text>;
});

const mockedUseVelocityLossInsights = require('../../../../app/components/Training/useVelocityLossInsights').useVelocityLossInsights as jest.Mock;

const TRAINING = {
  id: 1,
  doneWorkoutIds: {},
  plannedWorkouts: {},
  exercises: [],
  start: new Date('2025-01-01T10:00:00').toISOString(),
  end: new Date('2025-01-01T11:00:00').toISOString(),
  state: TrainingsState.FINISHED,
};

const TRAININGS_PLAN = {
  id: 1,
  name: 'Plan',
  trainingNames: {1: 'A'},
  trainings: {},
};

describe('TrainingsOverview', () => {
  beforeEach(() => {
    mockedUseVelocityLossInsights.mockReset();
  });

  it('renders no VL cards when vlInsights is empty', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const {queryAllByTestId} = render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} />,
    );

    expect(queryAllByTestId('vl-insight-card')).toHaveLength(0);
  });

  it('renders one VelocityLossInsightCard per insight', () => {
    mockedUseVelocityLossInsights.mockReturnValue([
      {exerciseId: 10, exerciseName: 'Squat', heaviestWeightKg: 100, currentVlPercent: 25, vlRirEstimate: '2', reportedRir: 2, microHistory: []},
      {exerciseId: 11, exerciseName: 'Bench', heaviestWeightKg: 80, currentVlPercent: 30, vlRirEstimate: '1', reportedRir: 1, microHistory: []},
    ]);

    const {getAllByTestId} = render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} />,
    );

    expect(getAllByTestId('vl-insight-card')).toHaveLength(2);
  });

  it('passes correct trainingsPlan and currentMicro to useVelocityLossInsights', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={5} />,
    );

    expect(mockedUseVelocityLossInsights).toHaveBeenCalledWith(TRAININGS_PLAN, 5);
  });
});
