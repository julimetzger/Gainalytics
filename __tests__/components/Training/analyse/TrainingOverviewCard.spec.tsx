import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingOverviewCard, {countRecordExercisesInMicro} from '../../../../app/components/Training/analyse/TrainingOverviewCard';
import {Record} from '../../../../app/models/entities/Exercise';
import {Training} from '../../../../app/models/entities/Training';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';
import {Workout} from '../../../../app/models/entities/Workout';
import {TrainingsState} from '../../../../app/models/TrainingsState';

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
} satisfies TrainingsPlan;

const createTraining = (training: Partial<Training> = {}): Training => ({
  id: 1,
  doneWorkoutIds: {},
  plannedWorkouts: {},
  exercises: [],
  state: TrainingsState.FINISHED,
  ...training,
});

const createWorkout = (workout: Partial<Workout> & Pick<Workout, 'exerciseId'>): Workout => ({
  sets: [],
  ...workout,
});

describe('TrainingOverviewCard', () => {
  beforeEach(() => {
    mockedUseAllTrainingsInMicro.mockReset();
    mockedUseWorkoutsByIds.mockReset();
  });

  it('counts unique exercises with one rep max records in a micro', () => {
    const workouts = [
      createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 100}}),
      createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 110}}),
      createWorkout({exerciseId: 2, records: {[Record.ONE_RM]: 120}}),
      createWorkout({exerciseId: 3}),
    ];

    expect(countRecordExercisesInMicro(workouts)).toBe(2);
  });

  it('renders a dedicated records stat with a signed comparison against the previous micro', () => {
    mockedUseAllTrainingsInMicro
      .mockReturnValueOnce([createTraining({doneWorkoutIds: {1: 101, 2: 102}, end: new Date('2024-02-10')})])
      .mockReturnValueOnce([createTraining({doneWorkoutIds: {1: 201}, end: new Date('2024-02-03')})]);
    mockedUseWorkoutsByIds
      .mockReturnValueOnce([createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 100}}), createWorkout({exerciseId: 2, records: {[Record.ONE_RM]: 120}})])
      .mockReturnValueOnce([createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 95}})])
      .mockReturnValueOnce([createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 95}})]);

    const {getByText, getByTestId, toJSON} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN} currentMicro={1} />);

    expect(getByText('Records')).toBeTruthy();
    expect(getByTestId('training-overview-records-value').props.children).toBe('2');
    expect(getByTestId('training-overview-records-comparison').props.children.join('')).toBe('+1');
    expect(getByText(/2 records/)).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it('does not render a records comparison when the previous micro has no completed workouts', () => {
    mockedUseAllTrainingsInMicro.mockReturnValueOnce([createTraining({doneWorkoutIds: {1: 101}})]).mockReturnValueOnce([createTraining({doneWorkoutIds: {1: 201}})]);
    mockedUseWorkoutsByIds
      .mockReturnValueOnce([createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 100}})])
      .mockReturnValueOnce([createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 95}})])
      .mockReturnValueOnce([]);

    const {getByTestId, queryByTestId} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN} currentMicro={1} />);

    expect(getByTestId('training-overview-records-value').props.children).toBe('1');
    expect(queryByTestId('training-overview-records-comparison')).toBeNull();
  });

  it('does not render a records comparison when the previous micro has no record data', () => {
    mockedUseAllTrainingsInMicro.mockReturnValueOnce([createTraining({doneWorkoutIds: {1: 101}})]).mockReturnValueOnce([createTraining({doneWorkoutIds: {1: 201}, end: new Date('2024-02-03')})]);
    mockedUseWorkoutsByIds
      .mockReturnValueOnce([createWorkout({exerciseId: 1, records: {[Record.ONE_RM]: 100}})])
      .mockReturnValueOnce([createWorkout({exerciseId: 1})])
      .mockReturnValueOnce([createWorkout({exerciseId: 1})]);

    const {getByTestId, queryByTestId} = render(<TrainingOverviewCard trainingsPlan={TRAININGS_PLAN} currentMicro={1} />);

    expect(getByTestId('training-overview-records-value').props.children).toBe('1');
    expect(queryByTestId('training-overview-records-comparison')).toBeNull();
  });
});
