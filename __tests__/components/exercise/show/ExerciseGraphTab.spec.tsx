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

// The default range of the tab is "3M", counted back from today, so the tab is rendered
// against a frozen clock: Wed 17/01/2024. The 3M range therefore starts on Tue 17/10/2023
// — deliberately in the middle of a week — and ends in the week of Mon 15/01/2024.
const NOW = new Date(2024, 0, 17, 12, 0);
const firstPlottedWeek = new Date(2023, 9, 16).getTime(); // Mon 16/10/23, the week the range starts in
const currentWeek = new Date(2024, 0, 15).getTime();

const frequencyPoints = () => mockChartValues.current[mockChartValues.current.length - 1];

describe('ExerciseGraphTab', () => {
  beforeAll(() => {
    // Only the clock is frozen. Faking the timer functions as well would deadlock
    // @testing-library/react-native's async cleanup between the tests.
    jest.useFakeTimers({
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'performance',
        'hrtime',
      ],
    });
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

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
    // The week of Mon 15/01 is the week the range ends in, so it is still running.
    expect(getByText('Week of Mon, 15/01/24: 1 training so far')).toBeTruthy();
  });

  it('shows the plotted week span so the covered period is not implicit', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    const {getByTestId} = render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    expect(getByTestId('graph-frequency-span').props.children).toEqual('Weeks from Mon, 16/10/23 to Mon, 15/01/24');
  });

  it('plots one weekly point per training count, zero-filling the training-free week', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    // The frequency chart is the fifth (and therefore last) chart rendered.
    expect(frequencyPoints().map((point: any) => point.y)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1]);
    expect(frequencyPoints()[11]).toEqual({x: new Date(2024, 0, 1).getTime(), y: 2, marker: '2'});
  });

  it('covers the whole selected range, from its first full week to the week it ends in', () => {
    mockedUseWorkoutsIn.mockReturnValue(threeTrainingsOverThreeWeeks);

    render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    expect(frequencyPoints()[0].x).toEqual(firstPlottedWeek);
    expect(frequencyPoints()[frequencyPoints().length - 1].x).toEqual(currentWeek);
  });

  it('loads the frequency workouts from the Monday of the week the range starts in', () => {
    // The 3M range starts on Tue 17/10/23, so the week of Mon 16/10/23 would be cut short.
    // The frequency graph asks for that whole week instead and counts it completely.
    mockedUseWorkoutsIn.mockReturnValue([
      workout(8, new Date(2023, 9, 16, 18, 0)), // Mon, one day BEFORE the range starts
      workout(9, new Date(2023, 9, 18, 18, 0)), // Wed, inside the range
      ...threeTrainingsOverThreeWeeks,
    ]);

    render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    const [metricRange, frequencyRange] = mockedUseWorkoutsIn.mock.calls.map((call) => call[0]);
    expect(metricRange.startDate).toEqual(new Date(2023, 9, 17));
    expect(frequencyRange.startDate).toEqual(new Date(2023, 9, 16));
    expect(frequencyRange.endDate).toEqual(metricRange.endDate);

    expect(frequencyPoints()[0]).toEqual({x: firstPlottedWeek, y: 2, marker: '2'});
  });

  it('keeps running to the current week when the exercise has not been trained for a while', () => {
    mockedUseWorkoutsIn.mockReturnValue([workout(1, new Date(2023, 11, 6, 18, 0))]); // Wed, week of Mon 04/12/23

    const {getByText} = render(<ExerciseGraphTab exercise={{id: 7, name: 'Deadlift'}} />);

    const points = frequencyPoints();
    expect(points[points.length - 1]).toEqual({x: currentWeek, y: 0, marker: '0'});
    expect(points.filter((point: any) => point.y > 0)).toEqual([{x: new Date(2023, 11, 4).getTime(), y: 1, marker: '1'}]);
    expect(getByText('Week of Mon, 15/01/24: 0 trainings so far, last trained Mon, 04/12/23 (1 training)')).toBeTruthy();
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
