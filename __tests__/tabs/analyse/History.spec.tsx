import React from 'react';
import {render, act} from '@testing-library/react-native';
import History, {buildHistoryRows} from '../../../app/tabs/Analyse/History';
import {useAllWorkoutIds} from '../../../app/redux/Workout/use/useAllWorkoutIds';
import {useWorkoutsByExerciseId} from '../../../app/redux/Workout/use/useWorkoutsByExerciseId';
import {useRoute} from '@react-navigation/native';

jest.mock('../../../app/redux/Workout/use/useAllWorkoutIds', () => ({
  useAllWorkoutIds: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutsByExerciseId', () => ({
  useWorkoutsByExerciseId: jest.fn(() => []),
}));

// History reads route.params?.exercise to decide between the full history and
// the Dashboard exercise drill-down — mock useRoute so both paths are testable.
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({params: undefined})),
}));

// Group every visible id into its own date bucket so the flattened row list
// has one header + one workout row per visible id. This lets the tests assert
// exactly how many workouts the current page window exposed.
jest.mock('../../../app/redux/Workout/use/useDateWorkoutMapByIds', () => ({
  useDateWorkoutMapByIds: jest.fn((ids: number[]) => new Map(ids.map((id, i) => [new Date(2026, 0, 1 + i), [id]]))),
}));

// Mock FlashList with a plain View that renders every item and exposes
// onEndReached as a prop the tests can fire to simulate scroll-to-end.
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    FlashList: ({data, renderItem, onEndReached, keyExtractor, testID}: any) => (
      <View testID={testID} onEndReached={onEndReached}>
        {data.map((item: any, index: number) => (
          <View key={keyExtractor ? keyExtractor(item, index) : index}>{renderItem({item, index})}</View>
        ))}
      </View>
    ),
  };
});

// The workout tile renders Redux-connected children; stub it down to a marker
// that also exposes the editable prop so the editable-rows behaviour is testable.
jest.mock('../../../app/components/Workout/show/WorkoutView', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return ({workoutId, editable}: {workoutId: number; editable?: boolean}) => (
    <Text testID="workout-row" accessibilityState={{disabled: editable === false}}>
      {workoutId}
    </Text>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return {
    Text: ({children, ...props}: {children: React.ReactNode}) => <Text {...props}>{children}</Text>,
    useTheme: () => ({fonts: {titleLarge: {fontSize: 22}}}),
  };
});

const mockUseAllWorkoutIds = jest.mocked(useAllWorkoutIds);
const mockUseWorkoutsByExerciseId = jest.mocked(useWorkoutsByExerciseId);
const mockUseRoute = jest.mocked(useRoute);

beforeEach(() => {
  mockUseRoute.mockReturnValue({params: undefined} as any);
  mockUseWorkoutsByExerciseId.mockReturnValue([]);
});

describe('buildHistoryRows', () => {
  it('flattens a date->workoutIds map into header + workout rows', () => {
    const map = new Map<Date, number[]>([
      [new Date(2026, 1, 28), [3, 2]],
      [new Date(2026, 1, 27), [1]],
    ]);
    const rows = buildHistoryRows(map);
    expect(rows.map((r) => r.type)).toEqual(['header', 'workout', 'workout', 'header', 'workout']);
    expect(rows.filter((r) => r.type === 'workout')).toHaveLength(3);
    // keys are stable and unique so FlashList can recycle correctly
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('returns an empty list for an empty map', () => {
    expect(buildHistoryRows(new Map())).toEqual([]);
  });
});

describe('History tab', () => {
  it('shows empty state when there are no workouts', () => {
    mockUseAllWorkoutIds.mockReturnValue([]);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-empty-state')).toBeTruthy();
    expect(queryByTestId('history-list-container')).toBeNull();
  });

  it('renders the FlashList container when workouts exist', () => {
    mockUseAllWorkoutIds.mockReturnValue([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-list-container')).toBeTruthy();
    expect(getByTestId('history-flash-list')).toBeTruthy();
    expect(queryByTestId('history-empty-state')).toBeNull();
  });

  it('initially renders at most PAGE_SIZE (20) workouts', () => {
    mockUseAllWorkoutIds.mockReturnValue(Array.from({length: 50}, (_, i) => 50 - i));
    const {getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);
  });

  it('loads the next batch when onEndReached fires', () => {
    mockUseAllWorkoutIds.mockReturnValue(Array.from({length: 50}, (_, i) => 50 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    expect(getAllByTestId('workout-row')).toHaveLength(40);
  });

  it('caps the visible window at the total workout count', () => {
    mockUseAllWorkoutIds.mockReturnValue(Array.from({length: 25}, (_, i) => 25 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    // 20 + 20 = 40 but only 25 exist, so it caps at 25
    expect(getAllByTestId('workout-row')).toHaveLength(25);
  });

  it('shows all workouts when the total is below PAGE_SIZE', () => {
    mockUseAllWorkoutIds.mockReturnValue([5, 4, 3, 2, 1]);
    const {getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(5);
  });

  it('does not grow the window when already showing every workout', () => {
    mockUseAllWorkoutIds.mockReturnValue(Array.from({length: 20}, (_, i) => 20 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    expect(getAllByTestId('workout-row')).toHaveLength(20);
  });

  it('renders a date header for each grouped batch', () => {
    mockUseAllWorkoutIds.mockReturnValue([3, 2, 1]);
    const {getAllByTestId} = render(<History />);
    // mocked useDateWorkoutMapByIds buckets each id under its own date
    expect(getAllByTestId('history-date-header')).toHaveLength(3);
  });

  it('renders workout rows as editable so long-press edit/delete works', () => {
    mockUseAllWorkoutIds.mockReturnValue([1]);
    const {getAllByTestId} = render(<History />);
    // editable===false would set disabled:true on the stubbed tile; rows must stay editable
    expect(getAllByTestId('workout-row')[0].props.accessibilityState.disabled).toBe(false);
  });
});

describe('History tab — Dashboard exercise drill-down', () => {
  it('shows only the drilled-down exercise workouts when an exercise param is present', () => {
    // Full history would be these ids; the exercise drill-down must ignore them.
    mockUseAllWorkoutIds.mockReturnValue([99, 98, 97]);
    mockUseRoute.mockReturnValue({params: {exercise: {id: 7, name: 'Bench Press'}}} as any);
    mockUseWorkoutsByExerciseId.mockReturnValue([
      {id: 11, exerciseId: 7, sets: [], start: new Date(2026, 0, 10), end: new Date(2026, 0, 10)},
      {id: 12, exerciseId: 7, sets: [], start: new Date(2026, 0, 20), end: new Date(2026, 0, 20)},
    ] as any);

    const {getAllByTestId} = render(<History />);
    const rows = getAllByTestId('workout-row').map((r) => r.props.children);
    // only the exercise's two workouts, newest-first (id 12 before id 11)
    expect(rows).toEqual([12, 11]);
  });

  it('passes the exercise id from the route param to useWorkoutsByExerciseId', () => {
    mockUseAllWorkoutIds.mockReturnValue([]);
    mockUseRoute.mockReturnValue({params: {exercise: {id: 42, name: 'Squat'}}} as any);
    mockUseWorkoutsByExerciseId.mockReturnValue([]);

    render(<History />);
    expect(mockUseWorkoutsByExerciseId).toHaveBeenCalledWith(42);
  });
});
