import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import TrainingLengthTab from '../../../app/tabs/Analyse/TrainingLengthTab';
import {useCompletedTrainingsIn} from '../../../app/redux/Training/use/useCompletedTrainingsIn';
import {useAllTrainingsPlans} from '../../../app/redux/Training/use/useAllTrainingsPlans';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';

jest.mock('../../../app/redux/Training/use/useCompletedTrainingsIn', () => ({
  useCompletedTrainingsIn: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useAllTrainingsPlans', () => ({
  useAllTrainingsPlans: jest.fn(),
}));

// GH-458: the screen now carries the shared stale-range banner. jest.setup.js
// stubs useSelector globally to () => [], which would hand the banner an array
// where it expects a Date, so the store-backed hooks are mocked explicitly.
jest.mock('../../../app/redux/Workout/use/useLastWorkoutDate', () => ({
  useLastWorkoutDate: jest.fn(() => undefined),
  useLastWorkoutDateForExercises: jest.fn(() => undefined),
}));

jest.mock('../../../app/components/analyse/TrainingLengthEditDialog', () => {
  const React = require('react');
  const {Text} = require('react-native');

  return ({bucket}: {bucket: {key: string} | null}) => (bucket ? <Text testID="training-length-edit-dialog-marker">{bucket.key}</Text> : null);
});

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const React = require('react');
  const {Text} = require('react-native');

  class Range {
    startDate: Date;
    endDate: Date;

    constructor(startDate: Date, endDate: Date) {
      this.startDate = new Date(startDate);
      this.endDate = new Date(endDate);
    }
  }

  return {
    __esModule: true,
    default: () => <Text>Mocked Range Picker</Text>,
    Range,
  };
});

jest.mock('react-native-charts-wrapper', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return {
    BarChart: ({data, highlights}: {data: {dataSets?: Array<{values?: Array<{x: number}>}>}; highlights?: Array<{x: number}>}) => {
      const values = data.dataSets?.[0]?.values ?? [];
      return (
        <View>
          <Text>{`Bars: ${values.length}`}</Text>
          <Text testID="mock-bar-chart-highlight">{highlights?.[0]?.x ?? 'none'}</Text>
        </View>
      );
    },
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  const Card = ({children, testID}: {children: React.ReactNode; testID?: string}) => <View testID={testID}>{children}</View>;
  Card.Title = ({title}: {title: string}) => <Text>{title}</Text>;
  Card.Content = ({children}: {children: React.ReactNode}) => <View>{children}</View>;

  return {
    Card,
    SegmentedButtons: ({buttons, onValueChange}: {buttons: Array<{label: string; value: string; testID?: string}>; onValueChange: (value: string) => void}) => (
      <View>
        {buttons.map((button) => (
          <TouchableOpacity key={button.value} testID={button.testID} onPress={() => onValueChange(button.value)}>
            <Text>{button.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({
      colors: {
        background: '#ffffff',
        onSurfaceVariant: '#222222',
        primary: '#336699',
        primaryContainer: '#cfe3ff',
        secondary: '#224466',
        outline: '#999999',
        onBackground: '#111111',
      },
    }),
  };
});

const mockedUseCompletedTrainingsIn = jest.mocked(useCompletedTrainingsIn);
const mockedUseAllTrainingsPlans = jest.mocked(useAllTrainingsPlans);

const createTraining = (training: Partial<Training>) =>
  ({
    id: training.id,
    doneWorkoutIds: training.doneWorkoutIds ?? {},
    plannedWorkouts: training.plannedWorkouts ?? {},
    exercises: training.exercises ?? [],
    start: training.start,
    end: training.end,
    state: training.state ?? TrainingsState.PLANNED,
  } satisfies Training);

const createTrainingsPlan = (trainingsPlan: Partial<TrainingsPlan>) =>
  ({
    id: trainingsPlan.id,
    name: trainingsPlan.name ?? 'Plan',
    description: trainingsPlan.description,
    trainings: trainingsPlan.trainings ?? {},
    trainingNames: trainingsPlan.trainingNames ?? {},
    lastTraining: trainingsPlan.lastTraining,
  } satisfies TrainingsPlan);

describe('TrainingLengthTab', () => {
  const pressChart = (getByTestId: (testID: string) => any, locationX = 160) => fireEvent.press(getByTestId('training-length-chart'), {nativeEvent: {locationX}});

  const longPressChart = (getByTestId: (testID: string) => any, locationX = 160) => fireEvent(getByTestId('training-length-chart'), 'onLongPress', {nativeEvent: {locationX}});

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the chart and updates the accumulation label when the mode changes', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([]);
    mockedUseCompletedTrainingsIn.mockReturnValue([
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-12T09:00:00.000Z'),
        end: new Date('2026-03-12T10:30:00.000Z'),
      }),
    ]);

    const {getByText, getByTestId} = render(<TrainingLengthTab />);

    expect(getByText('Training Length')).toBeTruthy();
    expect(getByText('Grouped by Day')).toBeTruthy();
    expect(getByText('Bars: 1')).toBeTruthy();
    expect(getByTestId('training-length-chart')).toBeTruthy();

    fireEvent.press(getByTestId('training-length-accumulation-week'));

    expect(getByText('Grouped by Week')).toBeTruthy();
  });

  it('shows the selected bucket trainings with name, date, and length', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([
      createTrainingsPlan({
        id: 10,
        name: 'Powerlifting',
        trainings: {'1,1': 1, '1,2': 2},
        trainingNames: {1: 'Squat Day', 2: 'Bench Day'},
      }),
    ]);
    mockedUseCompletedTrainingsIn.mockReturnValue([
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-12T09:00:00.000Z'),
        end: new Date('2026-03-12T10:30:00.000Z'),
      }),
      createTraining({
        id: 2,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-14T08:00:00.000Z'),
        end: new Date('2026-03-14T09:00:00.000Z'),
      }),
    ]);

    const {getByTestId, getByText} = render(<TrainingLengthTab />);

    fireEvent.press(getByTestId('training-length-accumulation-week'));
    pressChart(getByTestId);

    expect(getByTestId('training-length-selected-bucket')).toBeTruthy();
    expect(getByTestId('training-length-selected-trainings')).toBeTruthy();
    expect(getByText('Average duration')).toBeTruthy();
    expect(getByText('1 h 15 min')).toBeTruthy();
    expect(getByText('Squat Day')).toBeTruthy();
    expect(getByText('Bench Day')).toBeTruthy();
    expect(getByText('12 Mar 2026')).toBeTruthy();
    expect(getByText('14 Mar 2026')).toBeTruthy();
    expect(getByText('1 h 30 min')).toBeTruthy();
    expect(getByText('1 h')).toBeTruthy();
  });

  it('hides the bucket details when the same bar is tapped a second time', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([]);
    mockedUseCompletedTrainingsIn.mockReturnValue([
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-12T09:00:00.000Z'),
        end: new Date('2026-03-12T10:30:00.000Z'),
      }),
    ]);

    const {getByTestId, queryByTestId} = render(<TrainingLengthTab />);

    expect(queryByTestId('training-length-selected-bucket')).toBeNull();

    pressChart(getByTestId);
    expect(getByTestId('training-length-selected-bucket')).toBeTruthy();

    pressChart(getByTestId);
    expect(queryByTestId('training-length-selected-bucket')).toBeNull();
  });

  it('opens the edit dialog when a bar is long-pressed directly', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([]);
    mockedUseCompletedTrainingsIn.mockReturnValue([
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-12T09:00:00.000Z'),
        end: new Date('2026-03-12T10:30:00.000Z'),
      }),
    ]);

    const {getByTestId} = render(<TrainingLengthTab />);

    longPressChart(getByTestId);

    expect(getByTestId('training-length-edit-dialog-marker')).toBeTruthy();
  });

  it('switches the detail table when a different bar is tapped', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([
      createTrainingsPlan({
        id: 10,
        trainings: {'1,1': 1, '1,2': 2},
        trainingNames: {1: 'Squat Day', 2: 'Bench Day'},
      }),
    ]);
    mockedUseCompletedTrainingsIn.mockReturnValue([
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-09T09:00:00.000Z'),
        end: new Date('2026-03-09T10:30:00.000Z'),
      }),
      createTraining({
        id: 2,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-16T08:00:00.000Z'),
        end: new Date('2026-03-16T09:00:00.000Z'),
      }),
    ]);

    const {getByTestId, getByText, queryByText} = render(<TrainingLengthTab />);

    // Select first bar (Squat Day week)
    pressChart(getByTestId, 100);
    expect(getByText('Squat Day')).toBeTruthy();
    expect(queryByText('Bench Day')).toBeNull();

    // Select second bar (Bench Day week) — detail should switch
    pressChart(getByTestId, 250);
    expect(getByText('Bench Day')).toBeTruthy();
    expect(queryByText('Squat Day')).toBeNull();
  });

  it('shows a clear empty state when no completed trainings are available', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([]);
    mockedUseCompletedTrainingsIn.mockReturnValue([]);

    const {getByTestId, getByText, queryByTestId} = render(<TrainingLengthTab />);

    expect(getByTestId('training-length-empty-state')).toBeTruthy();
    expect(getByText('No completed trainings in this range')).toBeTruthy();
    expect(queryByTestId('training-length-chart')).toBeNull();
  });

  it('opens the edit dialog when a selected bar is long-pressed', () => {
    mockedUseAllTrainingsPlans.mockReturnValue([]);
    mockedUseCompletedTrainingsIn.mockReturnValue([
      createTraining({
        id: 1,
        state: TrainingsState.FINISHED,
        start: new Date('2026-03-12T09:00:00.000Z'),
        end: new Date('2026-03-12T10:30:00.000Z'),
      }),
    ]);

    const {getByTestId} = render(<TrainingLengthTab />);

    pressChart(getByTestId);
    longPressChart(getByTestId);

    expect(getByTestId('training-length-edit-dialog-marker')).toBeTruthy();
  });
});
