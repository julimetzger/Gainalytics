import React from 'react';
import {render} from '@testing-library/react-native';
import ExerciseGraphTab from '../../../../app/components/exercise/show/ExerciseGraphTab';
import {Workout} from '../../../../app/models/entities/Workout';
import {useWorkoutsIn} from '../../../../app/redux/Workout/use/useWorkoutsIn';

const mockChartProps: {current: any[]} = {current: []};
const mockChartValues: {current: any[][]} = {current: []};

jest.mock('../../../../app/redux/Workout/use/useWorkoutsIn', () => ({
  useWorkoutsIn: jest.fn(),
}));

jest.mock('react-native-charts-wrapper', () => {
  const ReactLocal = require('react');
  const {View} = require('react-native');
  return {
    LineChart: (props: any) => {
      mockChartProps.current.push(props);
      mockChartValues.current.push(props.data.dataSets[0].values);
      return ReactLocal.createElement(View, {testID: 'line-chart'});
    },
  };
});

jest.mock('react-native-paper', () => {
  const ReactLocal = require('react');
  const {Text, View} = require('react-native');
  const Card = ({children}: any) => ReactLocal.createElement(View, null, children);
  Card.Title = ({title, subtitle, testID}: any) =>
    ReactLocal.createElement(
      View,
      {testID},
      ReactLocal.createElement(Text, null, title),
      subtitle ? ReactLocal.createElement(Text, null, subtitle) : null,
    );
  Card.Content = ({children}: any) => ReactLocal.createElement(View, null, children);
  return {
    Card,
    Chip: ({children, testID}: any) => ReactLocal.createElement(View, {testID}, ReactLocal.createElement(Text, null, children)),
    Text: ({children, testID}: any) => ReactLocal.createElement(Text, {testID}, children),
    useTheme: () => ({
      colors: {
        background: '#000',
        onBackground: '#fff',
        primary: '#88f',
        secondary: '#8f8',
        tertiary: '#f88',
        backdrop: '#111',
        onSurfaceVariant: '#999',
      },
    }),
  };
});

const mockedUseWorkoutsIn = jest.mocked(useWorkoutsIn);

const workout = (id: number, start: Date): Workout => ({
  id,
  exerciseId: 7,
  sets: [{index: 1, reps: 5, rir: 1, weight: 100}],
  start,
});

const threeTrainingsOverThreeWeeks = [
  workout(1, new Date(2024, 0, 2, 18, 0)), // Tue, week of Mon 01/01
  workout(2, new Date(2024, 0, 4, 18, 0)), // Thu, week of Mon 01/01
  workout(3, new Date(2024, 0, 17, 18, 0)), // Wed, week of Mon 15/01
];

describe('ExerciseGraphTab', () => {
  beforeEach(() => {
    mockChartProps.current = [];
    mockChartValues.current = [];
  });

  it('renders the four existing graphs unchanged and adds Frequency as the fifth', () => {
    mockedUseWorkoutsIn.mockReturnValue([workout(1, new Date(2024, 0, 2, 18, 0))]);

    const {getAllByTestId} = render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    expect(getAllByTestId(/^graph-card-/).map((node) => node.props.testID)).toEqual([
      'graph-card-1RM',
      'graph-card-Volume',
      'graph-card-Average Intensity',
      'graph-card-Max Intensity',
      'graph-card-Frequency',
    ]);
  });

  it('labels the accumulation period of the frequency graph and reports the latest week', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    const {getByText, getByTestId} = render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    expect(getByText('Trainings per week (Mon–Sun)')).toBeTruthy();
    expect(getByTestId('graph-frequency-latest')).toBeTruthy();
    expect(getByText('Week of Mon, 15/01/24: 1 training')).toBeTruthy();
  });

  it('plots one weekly point per training count, zero-filling the training-free week', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    // The frequency chart is the fifth (and therefore last) chart rendered.
    expect(mockChartValues.current[mockChartValues.current.length - 1]).toEqual([
      {x: new Date(2024, 0, 1).getTime(), y: 2, marker: '2'},
      {x: new Date(2024, 0, 8).getTime(), y: 0, marker: '0'},
      {x: new Date(2024, 0, 15).getTime(), y: 1, marker: '1'},
    ]);
  });

  it('keeps the four existing graphs on their daily summary', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    const oneRmPoints = mockChartValues.current[0];
    expect(oneRmPoints.map((point) => point.x)).toEqual([
      new Date(2024, 0, 2).getTime(),
      new Date(2024, 0, 4).getTime(),
      new Date(2024, 0, 17).getTime(),
    ]);
  });

  it('draws the count series with straight segments and whole-number axes, leaving the existing graphs bezier-smoothed', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    const oneRm = mockChartProps.current[0];
    const frequency = mockChartProps.current[mockChartProps.current.length - 1];

    expect(oneRm.data.dataSets[0].config.mode).toEqual('HORIZONTAL_BEZIER');
    expect(oneRm.yAxis).toEqual({left: {textColor: expect.anything()}, right: {textColor: expect.anything()}});

    expect(frequency.data.dataSets[0].config.mode).toEqual('LINEAR');
    expect(frequency.yAxis).toEqual({
      left: {textColor: expect.anything(), granularity: 1, granularityEnabled: true, axisMinimum: 0},
      right: {textColor: expect.anything(), granularity: 1, granularityEnabled: true, axisMinimum: 0},
    });
  });

  it('shows the empty state instead of crashing for an exercise without training history', () => {
    mockedUseWorkoutsIn.mockReturnValue([]);

    const {getAllByText, getByTestId, queryByTestId} = render(<ExerciseGraphTab exercise={{id: 99, name: 'Fresh exercise'}} />);

    expect(getByTestId('graph-card-Frequency')).toBeTruthy();
    expect(getAllByText('No data in this range.')).toHaveLength(5);
    expect(queryByTestId('graph-frequency-latest')).toBeNull();
  });
});
