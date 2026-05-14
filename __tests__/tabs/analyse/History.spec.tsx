import React from 'react';
import {render, act} from '@testing-library/react-native';
import History from '../../../app/tabs/Analyse/History';
import {useAllFinishedWorkoutIds} from '../../../app/redux/Workout/use/useAllFinishedWorkoutIds';

jest.mock('../../../app/redux/Workout/use/useAllFinishedWorkoutIds', () => ({
  useAllFinishedWorkoutIds: jest.fn(),
}));

const mockUseAllFinishedWorkoutIds = jest.mocked(useAllFinishedWorkoutIds);

jest.mock('../../../app/components/Workout/show/WorkoutDoneList', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  return ({workoutIds}: {workoutIds: number[]}) => (
    <View testID="mock-workout-done-list">
      <Text testID="visible-count">{workoutIds.length}</Text>
    </View>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return {
    Text: ({children, ...props}: {children: React.ReactNode}) => <Text {...props}>{children}</Text>,
  };
});

describe('History tab', () => {
  it('shows empty state when there are no workouts', () => {
    mockUseAllFinishedWorkoutIds.mockReturnValue([]);
    const {getByTestId} = render(<History />);
    expect(getByTestId('history-empty-state')).toBeTruthy();
  });

  it('shows the scrollable list when workouts exist', () => {
    const ids = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    mockUseAllFinishedWorkoutIds.mockReturnValue(ids);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-list-container')).toBeTruthy();
    expect(getByTestId('mock-workout-done-list')).toBeTruthy();
    expect(queryByTestId('history-empty-state')).toBeNull();
  });

  it('initially renders PAGE_SIZE (20) items at most', () => {
    const ids = Array.from({length: 50}, (_, i) => 50 - i);
    mockUseAllFinishedWorkoutIds.mockReturnValue(ids);
    const {getByTestId} = render(<History />);
    expect(getByTestId('visible-count').props.children).toBe(20);
  });

  it('loads the next batch when loadMore is triggered via onScroll', () => {
    const ids = Array.from({length: 50}, (_, i) => 50 - i);
    mockUseAllFinishedWorkoutIds.mockReturnValue(ids);
    const {getByTestId} = render(<History />);
    expect(getByTestId('visible-count').props.children).toBe(20);

    // Simulate scroll near the bottom to trigger loadMore
    act(() => {
      getByTestId('history-list-container').props.onScroll({
        nativeEvent: {
          layoutMeasurement: {height: 800},
          contentOffset: {y: 4800},
          contentSize: {height: 5000},
        },
      });
    });

    expect(getByTestId('visible-count').props.children).toBe(40);
  });

  it('does not exceed total workout count when end is reached', () => {
    const ids = Array.from({length: 25}, (_, i) => 25 - i);
    mockUseAllFinishedWorkoutIds.mockReturnValue(ids);
    const {getByTestId} = render(<History />);

    act(() => {
      getByTestId('history-list-container').props.onScroll({
        nativeEvent: {
          layoutMeasurement: {height: 800},
          contentOffset: {y: 4800},
          contentSize: {height: 5000},
        },
      });
    });

    // 20 + 20 = 40 but total is 25, so should cap at 25
    expect(getByTestId('visible-count').props.children).toBe(25);
  });

  it('shows all workouts when total is less than PAGE_SIZE', () => {
    const ids = [5, 4, 3, 2, 1];
    mockUseAllFinishedWorkoutIds.mockReturnValue(ids);
    const {getByTestId} = render(<History />);
    expect(getByTestId('visible-count').props.children).toBe(5);
  });

  it('does not loadMore when already at total count', () => {
    const ids = Array.from({length: 20}, (_, i) => 20 - i);
    mockUseAllFinishedWorkoutIds.mockReturnValue(ids);
    const {getByTestId} = render(<History />);

    act(() => {
      getByTestId('history-list-container').props.onScroll({
        nativeEvent: {
          layoutMeasurement: {height: 800},
          contentOffset: {y: 4800},
          contentSize: {height: 5000},
        },
      });
    });

    // Already showing all 20, no extra load
    expect(getByTestId('visible-count').props.children).toBe(20);
  });
});
