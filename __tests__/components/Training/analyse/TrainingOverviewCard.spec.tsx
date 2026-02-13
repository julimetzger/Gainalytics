import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingOverviewCard, {countRecordExercisesInMicro} from '../../../../app/components/Training/analyse/TrainingOverviewCard';
import {Workout} from '../../../../app/models/Workout';

jest.mock('../../../../app/redux/Training/use/useAllTrainingsInMicro', () => ({
  useAllTrainingsInMicro: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(),
}));

jest.mock('../../../../app/utils/AnalyseUtils', () => ({
  calculateMetricValue: jest.fn(() => 0),
}));

const mockedUseAllTrainingsInMicro = require('../../../../app/redux/Training/use/useAllTrainingsInMicro').useAllTrainingsInMicro as jest.Mock;
const mockedUseWorkoutsByIds = require('../../../../app/redux/Workout/use/useWorkoutsByIds').useWorkoutsByIds as jest.Mock;

const TRAININGS_PLAN = {
  id: 1,
  name: 'Plan',
  trainingNames: {1: 'A', 2: 'B'},
  trainings: {},
};

describe('TrainingOverviewCard', () => {
  beforeEach(() => {
    mockedUseAllTrainingsInMicro.mockReset();
    mockedUseWorkoutsByIds.mockReset();
  });

  it('counts record exercises in micro', () => {
    const workouts = [
      {exerciseId: 1, records: {'1RM': 100}} as Workout,
      {exerciseId: 1, records: {'1RM': 110}} as Workout,
      {exerciseId: 2, records: {'1RM': 120}} as Workout,
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

    const {toJSON, getByText} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN as any} currentMicro={1} />);

    expect(getByText(/2 records/)).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });
});
