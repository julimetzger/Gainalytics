import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingPlanOverview from '../../../../app/components/Training/analyse/TrainingPlanOverview';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../../app/models/TrainingsState';

const mockUseWorkoutsByIds = jest.fn();
const mockUseAllTrainingsInMicro = jest.fn();
const mockMuscleCard = jest.fn();
const mockMetricsOverview = jest.fn();

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: (...args: unknown[]) => mockUseWorkoutsByIds(...args),
}));

// The micro-wide hook must NOT be consulted here at all — the regression this
// guards is a training's analysis showing the whole micro's numbers (GH-436).
jest.mock('../../../../app/redux/Training/use/useAllTrainingsInMicro', () => ({
  useAllTrainingsInMicro: (...args: unknown[]) => mockUseAllTrainingsInMicro(...args),
}));

jest.mock('../../../../app/components/Training/plan/MuscleInvolvementCard', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return (props: any) => {
    mockMuscleCard(props);
    return <Text testID="muscle-involvement-card-mock">{`${props.trainingsPlanId}/${props.micro}/${props.trainingInMicro}/${props.view}`}</Text>;
  };
});

jest.mock('../../../../app/components/analyse/MetricsOverviewForWorkouts', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return (props: any) => {
    mockMetricsOverview(props);
    return <Text testID="metrics-overview-mock">metrics</Text>;
  };
});

jest.mock('../../../../app/components/analyse/CollapsibleSection', () => {
  const React = require('react');
  const {View} = require('react-native');
  return ({id, children}: any) => <View testID={`analysis-section-${id}`}>{children}</View>;
});

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>};
});

const PLAN = {id: 7, name: 'Push pull', trainings: {'1,1': 10, '1,2': 11}, trainingNames: {1: 'Push', 2: 'Pull'}} as unknown as TrainingsPlan;

const set = (weight: number, reps: number) => ({weight, reps});

const THIS_TRAINING = {
  id: 10,
  state: TrainingsState.PLANNED,
  exercises: [1, 2],
  plannedWorkouts: {1: 100, 2: 101},
  doneWorkoutIds: {},
};

const WORKOUTS: Record<number, {id: number; sets: {weight: number; reps: number}[]}> = {
  100: {id: 100, sets: [set(100, 5), set(100, 5), set(100, 5)]},
  101: {id: 101, sets: [set(60, 8), set(60, 8)]},
  // belongs to the OTHER training in the micro — must never be counted here
  102: {id: 102, sets: [set(40, 12), set(40, 12), set(40, 12), set(40, 12)]},
};

describe('TrainingPlanOverview (GH-436 Plan position of one training)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkoutsByIds.mockImplementation((ids: number[]) => ids.map((id) => WORKOUTS[id]).filter(Boolean));
    mockUseAllTrainingsInMicro.mockReturnValue([THIS_TRAINING, {id: 11, plannedWorkouts: {3: 102}, doneWorkoutIds: {}}]);
  });

  it('totals only THIS training\'s planned sets, not the micro\'s', () => {
    const {getByTestId} = render(<TrainingPlanOverview training={THIS_TRAINING as any} trainingsPlan={PLAN} micro={1} trainingInMicro={1} />);

    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([100, 101]);
    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 5 (planned)');
    // the micro-wide aggregation is not even asked
    expect(mockUseAllTrainingsInMicro).not.toHaveBeenCalled();
  });

  it('shows the planned numbers of a training that has not been started yet', () => {
    const {getByTestId, queryByTestId, queryByText} = render(
      <TrainingPlanOverview training={THIS_TRAINING as any} trainingsPlan={PLAN} micro={1} trainingInMicro={1} />,
    );

    expect(getByTestId('metrics-overview-mock')).toBeTruthy();
    expect(mockMetricsOverview).toHaveBeenCalledWith(expect.objectContaining({trainingsWorkouts: [WORKOUTS[100], WORKOUTS[101]]}));
    expect(queryByTestId('training-plan-overview-empty')).toBeNull();
    expect(queryByText(/Analysis available after/)).toBeNull();
  });

  it('renders the single-training muscle map in its plan view for this slot', () => {
    const {getByTestId} = render(<TrainingPlanOverview training={THIS_TRAINING as any} trainingsPlan={PLAN} micro={4} trainingInMicro={2} />);

    expect(getByTestId('muscle-involvement-card-mock').props.children).toBe('7/4/2/plan');
    expect(getByTestId('analysis-section-muscleMap')).toBeTruthy();
    expect(getByTestId('analysis-section-metrics')).toBeTruthy();
  });

  it('stays a clean screen for a training without planned sets', () => {
    const {getByTestId, queryByTestId} = render(
      <TrainingPlanOverview training={{...THIS_TRAINING, plannedWorkouts: {}} as any} trainingsPlan={PLAN} micro={1} trainingInMicro={1} />,
    );

    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 0 (planned)');
    expect(getByTestId('training-plan-overview-empty').props.children).toBe('No sets planned for this training yet — add them on the Plan tab.');
    expect(queryByTestId('muscle-involvement-card-mock')).toBeNull();
    expect(queryByTestId('metrics-overview-mock')).toBeNull();
  });

  it('does not crash for a slot without any training', () => {
    const {getByTestId} = render(<TrainingPlanOverview training={undefined} trainingsPlan={PLAN} micro={1} trainingInMicro={3} />);

    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([]);
    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 0 (planned)');
    expect(getByTestId('training-plan-overview-empty').props.children).toBe('Nothing planned for this training yet.');
  });
});
