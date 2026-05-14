import React from 'react';
import {render, act} from '@testing-library/react-native';
import History, {buildHistoryRows} from '../../../app/tabs/Analyse/History';
import {useAllFinishedWorkoutIds} from '../../../app/redux/Workout/use/useAllFinishedWorkoutIds';

jest.mock('../../../app/redux/Workout/use/useAllFinishedWorkoutIds', () => ({
  useAllFinishedWorkoutIds: jest.fn(),
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

// The workout tile renders Redux-connected children; stub it down to a marker.
jest.mock('../../../app/components/Workout/show/WorkoutView', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return ({workoutId}: {workoutId: number}) => <Text testID="workout-row">{workoutId}</Text>;
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return {
    Text: ({children, ...props}: {children: React.ReactNode}) => <Text {...props}>{children}</Text>,
    useTheme: () => ({fonts: {titleLarge: {fontSize: 22}}}),
  };
});

const mockUseAllFinishedWorkoutIds = jest.mocked(useAllFinishedWorkoutIds);

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
    mockUseAllFinishedWorkoutIds.mockReturnValue([]);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-empty-state')).toBeTruthy();
    expect(queryByTestId('history-list-container')).toBeNull();
  });

  it('renders the FlashList container when workouts exist', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-list-container')).toBeTruthy();
    expect(getByTestId('history-flash-list')).toBeTruthy();
    expect(queryByTestId('history-empty-state')).toBeNull();
  });

  it('initially renders at most PAGE_SIZE (20) workouts', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue(Array.from({length: 50}, (_, i) => 50 - i));
    const {getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);
  });

  it('loads the next batch when onEndReached fires', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue(Array.from({length: 50}, (_, i) => 50 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    expect(getAllByTestId('workout-row')).toHaveLength(40);
  });

  it('caps the visible window at the total workout count', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue(Array.from({length: 25}, (_, i) => 25 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    // 20 + 20 = 40 but only 25 exist, so it caps at 25
    expect(getAllByTestId('workout-row')).toHaveLength(25);
  });

  it('shows all workouts when the total is below PAGE_SIZE', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue([5, 4, 3, 2, 1]);
    const {getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(5);
  });

  it('does not grow the window when already showing every workout', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue(Array.from({length: 20}, (_, i) => 20 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    expect(getAllByTestId('workout-row')).toHaveLength(20);
  });

  it('renders a date header for each grouped batch', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue([3, 2, 1]);
    const {getAllByTestId} = render(<History />);
    // mocked useDateWorkoutMapByIds buckets each id under its own date
    expect(getAllByTestId('history-date-header')).toHaveLength(3);
  });
});
