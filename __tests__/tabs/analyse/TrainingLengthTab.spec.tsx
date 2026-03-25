import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import TrainingLengthTab from '../../../app/tabs/Analyse/TrainingLengthTab';
import {useCompletedTrainingsIn} from '../../../app/redux/Training/use/useCompletedTrainingsIn';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';

jest.mock('../../../app/redux/Training/use/useCompletedTrainingsIn', () => ({
  useCompletedTrainingsIn: jest.fn(),
}));

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
  const {Text} = require('react-native');

  return {
    BarChart: ({data}: {data: {dataSets?: Array<{values?: unknown[]}>}}) => <Text>{`Bars: ${data.dataSets?.[0]?.values?.length ?? 0}`}</Text>,
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
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      buttons: Array<{label: string; value: string; testID?: string}>;
      onValueChange: (value: string) => void;
    }) => (
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

const createTraining = (training: Partial<Training>) =>
  ({
    id: training.id,
    doneWorkoutIds: training.doneWorkoutIds ?? {},
    plannedWorkouts: training.plannedWorkouts ?? {},
    exercises: training.exercises ?? [],
    start: training.start,
    end: training.end,
    state: training.state ?? TrainingsState.PLANNED,
  }) satisfies Training;

describe('TrainingLengthTab', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the chart and updates the accumulation label when the mode changes', () => {
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

  it('shows a clear empty state when no completed trainings are available', () => {
    mockedUseCompletedTrainingsIn.mockReturnValue([]);

    const {getByTestId, getByText, queryByTestId} = render(<TrainingLengthTab />);

    expect(getByTestId('training-length-empty-state')).toBeTruthy();
    expect(getByText('No completed trainings in this range')).toBeTruthy();
    expect(queryByTestId('training-length-chart')).toBeNull();
  });
});
