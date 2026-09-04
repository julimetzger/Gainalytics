import React from 'react';
import {render} from '@testing-library/react-native';
import MicroPlanOverview from '../../../../app/components/Training/analyse/MicroPlanOverview';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

const mockUseAllTrainingsInMicro = jest.fn();
const mockUseWorkoutsByIds = jest.fn();
const mockMetricsOverview = jest.fn();

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

jest.mock('../../../../app/components/analyse/MetricsOverviewForWorkouts', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return (props: any) => {
    mockMetricsOverview(props);
    return <Text testID="metrics-overview-mock">metrics</Text>;
  };
});

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({colors: {onSurfaceVariant: '#888'}}),
  };
});

const PLAN = {id: 7, name: 'Push pull', trainings: {}, trainingNames: {1: 'Push'}} as unknown as TrainingsPlan;

const set = (weight: number, reps: number) => ({weight, reps});

const PLANNED = [
  {id: 100, sets: [set(100, 5), set(100, 5), set(100, 5)]},
  {id: 101, sets: [set(60, 8), set(60, 8)]},
  {id: 102, sets: [set(40, 12)]},
];
const DONE = [
  {id: 200, sets: [set(100, 5), set(100, 5)]},
  {id: 202, sets: [set(40, 12), set(40, 12), set(40, 12), set(40, 12)]},
];

/** The hook is called once for the planned ids and once for the done ids. */
const answerWorkouts = () =>
  mockUseWorkoutsByIds.mockImplementation((ids: number[]) => [...PLANNED, ...DONE].filter((workout) => ids.includes(workout.id)));

describe('MicroPlanOverview (GH-417 Plan position, GH-436 moved into the Overview)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('totals the planned AND the done sets of every training in the micro', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([
      {id: 1, plannedWorkouts: {10: 100, 11: 101}, doneWorkoutIds: {10: 200}},
      {id: 2, plannedWorkouts: {12: 102}, doneWorkoutIds: {12: 202}},
    ]);
    answerWorkouts();

    const {getByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={3} />);

    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([100, 101, 102]);
    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([200, 202]);
    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 6 (planned)');
    expect(getByTestId('analysis-total-sets-done').props.children).toBe('Total Sets: 6 (done)');
  });

  it('puts the planned metrics next to what was trained (planned subject, done reference)', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1, plannedWorkouts: {10: 100}, doneWorkoutIds: {10: 200}}]);
    answerWorkouts();

    const {getByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={3} />);

    expect(getByTestId('muscle-card-args').props.children).toBe('7/3');
    expect(getByTestId('micro-plan-overview-caption')).toBeTruthy();
    expect(mockMetricsOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        trainingsWorkouts: [PLANNED[0]],
        previousWorkouts: [DONE[0]],
        showExercises: false,
      }),
    );
  });

  it('stays a clean, readable screen for a micro without planned sets (AC6)', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1, plannedWorkouts: {}, doneWorkoutIds: {10: 200}}]);
    answerWorkouts();

    const {getByTestId, queryByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={9} />);

    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 0 (planned)');
    // the done total still tells the user what happened in the micro
    expect(getByTestId('analysis-total-sets-done').props.children).toBe('Total Sets: 2 (done)');
    expect(getByTestId('micro-plan-overview-empty')).toBeTruthy();
    // not an empty white area, and no table of zeroes either
    expect(queryByTestId('micro-muscle-map-card-mock')).toBeNull();
    expect(queryByTestId('metrics-overview-mock')).toBeNull();
  });

  it('survives a micro whose trainings carry neither plannedWorkouts nor doneWorkoutIds', () => {
    mockUseAllTrainingsInMicro.mockReturnValue([{id: 1}]);
    mockUseWorkoutsByIds.mockReturnValue([]);

    const {getByTestId} = render(<MicroPlanOverview trainingsPlan={PLAN} micro={9} />);

    expect(mockUseWorkoutsByIds).toHaveBeenCalledWith([]);
    expect(getByTestId('micro-plan-overview-empty')).toBeTruthy();
    expect(getByTestId('analysis-total-sets-done').props.children).toBe('Total Sets: 0 (done)');
  });
});
