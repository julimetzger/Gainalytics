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
// exactly how many workouts the current page window exposed. The real hook
// uses a useSelector equality function to return a stable Map reference for
// equal contents; this mock mirrors that by caching by ids-key so the
// render-count test sees stable references for stable inputs.
const mockDateMapCache = new Map<string, Map<Date, number[]>>();
jest.mock('../../../app/redux/Workout/use/useDateWorkoutMapByIds', () => ({
  useDateWorkoutMapByIds: jest.fn((ids: number[]) => {
    const key = ids.join(',');
    let map = mockDateMapCache.get(key);
    if (!map) {
      map = new Map(ids.map((id, i) => [new Date(2026, 0, 1 + i), [id]]));
      mockDateMapCache.set(key, map);
    }
    return map;
  }),
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
// Each render is recorded on a shared spy so render-count tests can assert
// that unrelated parent re-renders do NOT cause additional WorkoutView renders.
// Wrapped in React.memo so the spy counts genuine prop-driven re-renders only
// — this mirrors the production WorkoutView which is itself memoized via
// useSelector equality fns / React.memo wrappers internally.
const mockWorkoutViewRenderSpy = jest.fn();
jest.mock('../../../app/components/Workout/show/WorkoutView', () => {
  const React = require('react');
  const {Text} = require('react-native');
  const Mock = ({workoutId, editable}: {workoutId: number; editable?: boolean}) => {
    mockWorkoutViewRenderSpy(workoutId);
    return (
      <Text testID="workout-row" accessibilityState={{disabled: editable === false}}>
        {workoutId}
      </Text>
    );
  };
  return React.memo(Mock);
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  // Return a stable theme reference so useCallback deps in History don't
  // invalidate on every call — the real useTheme also returns stable refs.
  const stableTheme = {fonts: {titleLarge: {fontSize: 22}}};
  return {
    Text: ({children, ...props}: {children: React.ReactNode}) => <Text {...props}>{children}</Text>,
    useTheme: () => stableTheme,
  };
});

const mockUseAllWorkoutIds = jest.mocked(useAllWorkoutIds);
const mockUseWorkoutsByExerciseId = jest.mocked(useWorkoutsByExerciseId);
const mockUseRoute = jest.mocked(useRoute);

beforeEach(() => {
  mockUseRoute.mockReturnValue({params: undefined} as any);
  mockUseWorkoutsByExerciseId.mockReturnValue([]);
  mockWorkoutViewRenderSpy.mockClear();
  mockDateMapCache.clear();
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

  // PR #280 review fb4 finding (1): when route.params.exercise is undefined,
  // useWorkoutsByExerciseId(undefined) must return a stable EMPTY_ARRAY so an
  // unrelated parent re-render (proxy for an unrelated Redux dispatch) does
  // NOT invalidate the History useMemo deps and re-render every workout row.
  // The hook itself is mocked here — the test asserts the History contract:
  // given stable inputs, the visible row count is unchanged AND no extra
  // WorkoutView renders fire beyond the initial mount of the visible window.
  it('does not re-render WorkoutView children on an unrelated parent re-render (stable EMPTY_ARRAY contract)', () => {
    const STABLE_EMPTY: never[] = [];
    const STABLE_IDS = [10, 9, 8, 7, 6];
    mockUseAllWorkoutIds.mockReturnValue(STABLE_IDS);
    mockUseWorkoutsByExerciseId.mockReturnValue(STABLE_EMPTY);

    const {rerender, getAllByTestId} = render(<History />);
    const initialRowCount = getAllByTestId('workout-row').length;
    expect(initialRowCount).toBe(5);
    const rendersBefore = mockWorkoutViewRenderSpy.mock.calls.length;

    // Simulate an unrelated Redux dispatch by forcing a parent re-render while
    // the mocked hooks continue to return the SAME references. With the
    // stable-ref contract in place, no new WorkoutView renders should fire.
    rerender(<History />);

    expect(getAllByTestId('workout-row').length).toBe(initialRowCount);
    expect(mockWorkoutViewRenderSpy.mock.calls.length).toBe(rendersBefore);
  });

  it('shows the English empty-state copy (AGENTS.md: app language is English only)', () => {
    mockUseAllWorkoutIds.mockReturnValue([]);
    const {getByText, queryByText} = render(<History />);
    expect(getByText('No workouts yet.')).toBeTruthy();
    // Guard against accidental reintroduction of the previous German copy.
    expect(queryByText('Noch keine Trainings vorhanden.')).toBeNull();
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
