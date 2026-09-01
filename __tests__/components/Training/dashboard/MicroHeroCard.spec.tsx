import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import MicroHeroCard from '../../../../app/components/Training/dashboard/MicroHeroCard';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

const mockChartProps: {current: any} = {current: null};

const mockState = {
  trainings: {
    byId: {
      10: {
        id: 10,
        start: '2026-07-01T10:00:00.000Z',
        end: '2026-07-01T11:00:00.000Z',
        doneWorkoutIds: {1: 100},
      },
      11: {
        id: 11,
        start: '2026-07-08T10:00:00.000Z',
        end: '2026-07-08T11:30:00.000Z',
        doneWorkoutIds: {1: 101},
      },
    },
  },
  workouts: {
    byId: {
      100: {
        id: 100,
        sets: [
          {weight: 100, reps: 10, rir: 2},
          {weight: 100, reps: 10, rir: 2},
        ],
      },
      101: {
        id: 101,
        sets: [{weight: 120, reps: 10, rir: 1}],
      },
    },
  },
};

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

jest.mock('react-native-charts-wrapper', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    BarChart: (props: any) => {
      mockChartProps.current = props;
      return <View testID="bar-chart" />;
    },
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const Card = ({children, testID}: any) => <View testID={testID}>{children}</View>;
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Card,
    SegmentedButtons: ({buttons, onValueChange}: any) => (
      <View>
        {buttons.map((b: any) => (
          <TouchableOpacity key={b.value} testID={`metric-${b.value}`} onPress={() => onValueChange(b.value)}>
            <Text>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({
      colors: {
        primary: '#123456',
        primaryContainer: '#654321',
        onSurface: '#222222',
        onSurfaceVariant: '#333333',
        error: '#ff0000',
      },
    }),
  };
});

jest.mock('../../../../app/components/Training/dashboard/CompletionRing', () => {
  const React = require('react');
  const {View} = require('react-native');
  return ({testID}: any) => React.createElement(View, {testID});
});

jest.mock('../../../../app/components/Training/dashboard/DayStrip', () => {
  const React = require('react');
  const {View} = require('react-native');
  return () => React.createElement(View, {testID: 'day-strip'});
});

const plan: TrainingsPlan = {
  id: 1,
  name: 'Strength Plan',
  trainings: {'1,1': 10, '2,1': 11},
  trainingNames: {},
} as TrainingsPlan;

const navigation = {navigate: jest.fn()} as any;

const getDataSetConfig = () => mockChartProps.current.data.dataSets[0].config;

const renderCard = (currentMicro = 2) =>
  render(<MicroHeroCard plan={plan} currentMicro={currentMicro} navigation={navigation} />);

describe('MicroHeroCard bar value labels (GH-342)', () => {
  beforeEach(() => {
    mockChartProps.current = null;
  });

  it('draws values above the bars', () => {
    renderCard();
    expect(mockChartProps.current.drawValueAboveBar).toBe(true);
    const config = getDataSetConfig();
    expect(config.drawValues).toBe(true);
    expect(Array.isArray(config.valueFormatter)).toBe(true);
  });

  it('labels each bar with its volume when the volume metric is selected', () => {
    renderCard();
    // Micro 1: 2 sets x 100kg x 10 reps = 2000; Micro 2: 120kg x 10 reps = 1200
    expect(getDataSetConfig().valueFormatter).toEqual([(2000).toLocaleString(), (1200).toLocaleString()]);
  });

  it('labels each bar with its set count when the sets metric is selected', () => {
    const {getByTestId} = renderCard();
    fireEvent.press(getByTestId('metric-sets'));
    expect(getDataSetConfig().valueFormatter).toEqual(['2', '1']);
  });

  it('labels each bar with a formatted duration when the time metric is selected', () => {
    const {getByTestId} = renderCard();
    fireEvent.press(getByTestId('metric-time'));
    // Micro 1: 60min -> "1h 0m"; Micro 2: 90min -> "1h 30m"
    expect(getDataSetConfig().valueFormatter).toEqual(['1h 0m', '1h 30m']);
  });

  it('labels micros without data with 0 instead of dropping the label', () => {
    renderCard(3);
    const labels = getDataSetConfig().valueFormatter;
    expect(labels).toHaveLength(3);
    expect(labels[2]).toBe('0');
  });

  it('keeps the bar values themselves unchanged (labels are display-only)', () => {
    renderCard();
    expect(mockChartProps.current.data.dataSets[0].values.map((v: any) => v.y)).toEqual([2000, 1200]);
  });
});

/**
 * GH-428 (H1), PR #430 review round 3, point 1: this card is the header of the
 * ACTIVE plan on the training home screen. For a plan created before the name
 * validation existed it rendered an empty title, while the row further down the
 * same screen already showed the fallback label — two names for one plan.
 */
describe('MicroHeroCard — nameless legacy plan', () => {
  const namelessPlan = {...plan, name: ''} as TrainingsPlan;

  beforeEach(() => {
    mockChartProps.current = null;
  });

  it('shows the fallback label when the plan has no name', () => {
    const {getByTestId} = render(<MicroHeroCard plan={namelessPlan} currentMicro={2} navigation={navigation} />);

    expect(getByTestId('micro-hero-plan-name').props.children).toBe('Unnamed plan');
  });

  it('still shows a real plan name unchanged', () => {
    const {getByTestId} = renderCard();

    expect(getByTestId('micro-hero-plan-name').props.children).toBe('Strength Plan');
  });
});
