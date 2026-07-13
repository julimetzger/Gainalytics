import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingsOverview from '../../../../app/components/Training/analyse/TrainingsOverview';
import {TrainingsState} from '../../../../app/models/TrainingsState';

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(() => []),
}));

jest.mock('../../../../app/redux/Workout/use/useLastFinishedWorkoutsByExerciseIds', () => ({
  useLastFinishedWorkoutsByExerciseIds: jest.fn(() => []),
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

jest.mock('../../../../app/components/Training/plan/MuscleInvolvementCard', () => () => null);

jest.mock('../../../../app/components/Training/analyse/TrainingMuscleGroupsCard', () => () => null);

const mockedUseVelocityLossInsights = require('../../../../app/components/Training/useVelocityLossInsights').useVelocityLossInsights as jest.Mock;
const mockedUseLastFinishedWorkoutsByExerciseIds = require('../../../../app/redux/Workout/use/useLastFinishedWorkoutsByExerciseIds').useLastFinishedWorkoutsByExerciseIds as jest.Mock;

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

const TRAINING_WITH_EXERCISES = {
  id: 2,
  doneWorkoutIds: {10: 100},
  plannedWorkouts: {},
  exercises: [10, 11],
  start: new Date('2025-02-01T10:00:00').toISOString(),
  end: new Date('2025-02-01T11:00:00').toISOString(),
  state: TrainingsState.FINISHED,
};

describe('TrainingsOverview', () => {
  beforeEach(() => {
    mockedUseVelocityLossInsights.mockReset();
    mockedUseLastFinishedWorkoutsByExerciseIds.mockReset();
    mockedUseLastFinishedWorkoutsByExerciseIds.mockReturnValue([]);
  });

  it('renders no VL cards when vlInsights is empty', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const {queryAllByTestId} = render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} trainingInMicro={0} />,
    );

    expect(queryAllByTestId('vl-insight-card')).toHaveLength(0);
  });

  it('renders one VelocityLossInsightCard per insight', () => {
    mockedUseVelocityLossInsights.mockReturnValue([
      {exerciseId: 10, exerciseName: 'Squat', heaviestWeightKg: 100, currentVlPercent: 25, vlRirEstimate: '2', reportedRir: 2, microHistory: []},
      {exerciseId: 11, exerciseName: 'Bench', heaviestWeightKg: 80, currentVlPercent: 30, vlRirEstimate: '1', reportedRir: 1, microHistory: []},
    ]);

    const {getAllByTestId} = render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} trainingInMicro={0} />,
    );

    expect(getAllByTestId('vl-insight-card')).toHaveLength(2);
  });

  it('passes trainingsPlan, currentMicro, and training workout IDs to useVelocityLossInsights', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={5} trainingInMicro={0} />,
    );

    // Third argument must be a Set of the training's doneWorkoutIds values (empty for TRAINING)
    expect(mockedUseVelocityLossInsights).toHaveBeenCalledWith(TRAININGS_PLAN, 5, new Set());
  });

  it('passes the training workout IDs set correctly for a training with workouts', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    render(
      <TrainingsOverview training={TRAINING_WITH_EXERCISES as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} trainingInMicro={0} />,
    );

    // doneWorkoutIds: {10: 100} → Set([100])
    expect(mockedUseVelocityLossInsights).toHaveBeenCalledWith(TRAININGS_PLAN, 1, new Set([100]));
  });

  it('calls useLastFinishedWorkoutsByExerciseIds with training.exercises when no previousTraining', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    render(
      <TrainingsOverview training={TRAINING_WITH_EXERCISES as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} trainingInMicro={0} />,
    );

    expect(mockedUseLastFinishedWorkoutsByExerciseIds).toHaveBeenCalledWith(
      TRAINING_WITH_EXERCISES.exercises,
      Object.values(TRAINING_WITH_EXERCISES.doneWorkoutIds),
    );
  });

  it('shows "Duration (live)" and live-updating duration for a STARTED training (GH-367)', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const liveTraining = {
      ...TRAINING,
      start: new Date(Date.now() - 60000).toISOString(),
      end: undefined,
      state: TrainingsState.STARTED,
    };

    const {getByText, queryByText} = render(
      <TrainingsOverview training={liveTraining as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} trainingInMicro={0} />,
    );

    expect(getByText('Duration (live)')).toBeTruthy();
    expect(queryByText('Duration')).toBeNull();
  });

  it('shows plain "Duration" (not live) for a FINISHED training', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const {getByText, queryByText} = render(
      <TrainingsOverview training={TRAINING as any} trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} trainingInMicro={0} />,
    );

    expect(getByText('Duration')).toBeTruthy();
    expect(queryByText('Duration (live)')).toBeNull();
  });

  it('still calls useLastFinishedWorkoutsByExerciseIds when previousTraining is provided (hooks are unconditional)', () => {
    mockedUseVelocityLossInsights.mockReturnValue([]);

    const previousTraining = {
      id: 99,
      doneWorkoutIds: {10: 200},
      plannedWorkouts: {},
      exercises: [10],
      start: new Date('2025-01-01T10:00:00').toISOString(),
      end: new Date('2025-01-01T11:00:00').toISOString(),
      state: TrainingsState.FINISHED,
    };

    render(
      <TrainingsOverview
        training={TRAINING_WITH_EXERCISES as any}
        previousTraining={previousTraining as any}
        trainingsPlan={TRAININGS_PLAN as any}
        currentMicro={1}
        trainingInMicro={0}
      />,
    );

    // Hook is always called (React hooks can't be conditional); result is only used when no previousTraining
    expect(mockedUseLastFinishedWorkoutsByExerciseIds).toHaveBeenCalled();
  });
});
