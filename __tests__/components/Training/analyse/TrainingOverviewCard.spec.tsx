import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingOverviewCard, {countRecordExercisesInMicro} from '../../../../app/components/Training/analyse/TrainingOverviewCard';
import {Workout} from '../../../../app/models/entities/Workout';

jest.mock('../../../../app/redux/Training/use/useAllTrainingsInMicro', () => ({
  useAllTrainingsInMicro: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(),
}));

jest.mock('../../../../app/utils/AnalyseUtils', () => ({
  calculateMetricValue: jest.fn(() => 0),
}));

jest.mock('../../../../app/components/Training/useVelocityLossInsights', () => ({
  useVelocityLossInsights: jest.fn(),
}));

jest.mock('../../../../app/components/Training/VelocityLossInsightCard', () => {
  const {Text} = require('react-native');
  return ({exerciseName}: {exerciseName: string}) => <Text testID="vl-insight-card">{exerciseName}</Text>;
});

const mockedUseAllTrainingsInMicro = require('../../../../app/redux/Training/use/useAllTrainingsInMicro').useAllTrainingsInMicro as jest.Mock;
const mockedUseWorkoutsByIds = require('../../../../app/redux/Workout/use/useWorkoutsByIds').useWorkoutsByIds as jest.Mock;
const mockedUseVelocityLossInsights = require('../../../../app/components/Training/useVelocityLossInsights').useVelocityLossInsights as jest.Mock;

const TRAININGS_PLAN = {
  id: 1,
  name: 'Plan',
  trainingNames: {1: 'A', 2: 'B'},
  trainings: {},
};

const defaultSetup = () => {
  mockedUseAllTrainingsInMicro.mockReturnValue([{doneWorkoutIds: {}, exercises: [], plannedWorkouts: {}, state: 'F'}]);
  mockedUseWorkoutsByIds.mockReturnValue([]);
};

describe('TrainingOverviewCard', () => {
  beforeEach(() => {
    mockedUseAllTrainingsInMicro.mockReset();
    mockedUseWorkoutsByIds.mockReset();
    mockedUseVelocityLossInsights.mockReset();
  });

  it('counts record exercises in micro', () => {
    const workouts = [
      {exerciseId: 1, records: {'1RM': 100}, sets: []} satisfies Workout,
      {exerciseId: 1, records: {'1RM': 110}, sets: []} satisfies Workout,
      {exerciseId: 2, records: {'1RM': 120}, sets: []} satisfies Workout,
      {exerciseId: 3} as Workout,
    ];

    expect(countRecordExercisesInMicro(workouts)).toBe(2);
  });

  it('renders record count in overview row', () => {
    mockedUseAllTrainingsInMicro.mockReturnValue([{doneWorkoutIds: {}, exercises: [], plannedWorkouts: {}, state: 'F'}]);
    mockedUseWorkoutsByIds.mockReturnValue([
      {exerciseId: 1, records: {'1RM': 100}, sets: []},
      {exerciseId: 2, records: {'1RM': 120}, sets: []},
    ]);
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const {toJSON, getByText} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} />);

    expect(getByText(/2 records/)).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders no VL cards when vlInsights is empty', () => {
    defaultSetup();
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const {queryAllByTestId} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} />);

    expect(queryAllByTestId('vl-insight-card')).toHaveLength(0);
  });

  it('renders one VelocityLossInsightCard per insight when vlInsights has entries', () => {
    defaultSetup();
    mockedUseVelocityLossInsights.mockReturnValue([
      {exerciseId: 10, exerciseName: 'Squat', heaviestWeightKg: 100, currentVlPercent: 25, vlRirEstimate: '2', reportedRir: 2, microHistory: []},
      {exerciseId: 11, exerciseName: 'Bench', heaviestWeightKg: 80, currentVlPercent: 30, vlRirEstimate: '1', reportedRir: 1, microHistory: []},
    ]);

    const {getAllByTestId} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} />);

    expect(getAllByTestId('vl-insight-card')).toHaveLength(2);
  });
});
