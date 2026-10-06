import React from 'react';
import {render, act, fireEvent} from '@testing-library/react-native';
import History, {buildHistoryRows} from '../../../app/tabs/Analyse/History';
import {useWorkoutsByFilters} from '../../../app/redux/Workout/use/useWorkoutsByFilters';
import {useRoute} from '@react-navigation/native';

jest.mock('../../../app/redux/Workout/use/useWorkoutsByFilters', () => ({
  useWorkoutsByFilters: jest.fn(() => []),
}));

// History reads route.params?.exercise to decide the initial filter selection —
// mock useRoute so both paths are testable.
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

// Capture the setMuscle callback so tests can simulate muscle selection.
let capturedSetMuscle: ((m: any[]) => void) | undefined;

jest.mock('../../../app/components/picker/elements/TrainingElementPicker', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: ({exercise, setExercise, muscle, setMuscle, setMetric, setAccumulation, dropdownLabel}: any) => {
      capturedSetMuscle = setMuscle;
      return (
        <View
          testID="training-element-picker"
          accessibilityLabel={dropdownLabel}
          accessibilityHint={[setMetric && 'metric', setAccumulation && 'accumulation'].filter(Boolean).join(',')}
        />
      );
    },
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  // Return a stable theme reference so useCallback deps in History don't
  // invalidate on every call — the real useTheme also returns stable refs.
  const stableTheme = {fonts: {titleLarge: {fontSize: 22}}};
  return {
    Text: ({children, ...props}: {children: React.ReactNode}) => <Text {...props}>{children}</Text>,
    useTheme: () => stableTheme,
    IconButton: ({onPress, icon}: any) => <View testID="picker-toggle-button" onTouchEnd={onPress} accessibilityLabel={icon} />,
  };
});

const mockUseWorkoutsByFilters = jest.mocked(useWorkoutsByFilters);
const mockUseRoute = jest.mocked(useRoute);

beforeEach(() => {
  capturedSetMuscle = undefined;
  mockUseRoute.mockReturnValue({params: undefined} as any);
  mockUseWorkoutsByFilters.mockReturnValue([]);
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
    mockUseWorkoutsByFilters.mockReturnValue([]);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-empty-state')).toBeTruthy();
    expect(queryByTestId('history-list-container')).toBeNull();
  });

  it('renders the FlashList container when workouts exist', () => {
    mockUseWorkoutsByFilters.mockReturnValue([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const {getByTestId, queryByTestId} = render(<History />);
    expect(getByTestId('history-list-container')).toBeTruthy();
    expect(getByTestId('history-flash-list')).toBeTruthy();
    expect(queryByTestId('history-empty-state')).toBeNull();
  });

  it('initially renders at most PAGE_SIZE (20) workouts', () => {
    mockUseWorkoutsByFilters.mockReturnValue(Array.from({length: 50}, (_, i) => 50 - i));
    const {getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);
  });

  it('loads the next batch when onEndReached fires', () => {
    mockUseWorkoutsByFilters.mockReturnValue(Array.from({length: 50}, (_, i) => 50 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    expect(getAllByTestId('workout-row')).toHaveLength(40);
  });

  it('caps the visible window at the total workout count', () => {
    mockUseWorkoutsByFilters.mockReturnValue(Array.from({length: 25}, (_, i) => 25 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    // 20 + 20 = 40 but only 25 exist, so it caps at 25
    expect(getAllByTestId('workout-row')).toHaveLength(25);
  });

  it('shows all workouts when the total is below PAGE_SIZE', () => {
    mockUseWorkoutsByFilters.mockReturnValue([5, 4, 3, 2, 1]);
    const {getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(5);
  });

  it('does not grow the window when already showing every workout', () => {
    mockUseWorkoutsByFilters.mockReturnValue(Array.from({length: 20}, (_, i) => 20 - i));
    const {getByTestId, getAllByTestId} = render(<History />);
    expect(getAllByTestId('workout-row')).toHaveLength(20);

    act(() => {
      getByTestId('history-flash-list').props.onEndReached();
    });

    expect(getAllByTestId('workout-row')).toHaveLength(20);
  });

  it('renders a date header for each grouped batch', () => {
    mockUseWorkoutsByFilters.mockReturnValue([3, 2, 1]);
    const {getAllByTestId} = render(<History />);
    // mocked useDateWorkoutMapByIds buckets each id under its own date
    expect(getAllByTestId('history-date-header')).toHaveLength(3);
  });

  it('renders workout rows as editable so long-press edit/delete works', () => {
    mockUseWorkoutsByFilters.mockReturnValue([1]);
    const {getAllByTestId} = render(<History />);
    // editable===false would set disabled:true on the stubbed tile; rows must stay editable
    expect(getAllByTestId('workout-row')[0].props.accessibilityState.disabled).toBe(false);
  });

  it('does not re-render WorkoutView children on an unrelated parent re-render (stable ref contract)', () => {
    const STABLE_IDS = [10, 9, 8, 7, 6];
    mockUseWorkoutsByFilters.mockReturnValue(STABLE_IDS);

    const {rerender, getAllByTestId} = render(<History />);
    const initialRowCount = getAllByTestId('workout-row').length;
    expect(initialRowCount).toBe(5);
    const rendersBefore = mockWorkoutViewRenderSpy.mock.calls.length;

    // Simulate an unrelated Redux dispatch by forcing a parent re-render while
    // the mocked hook continues to return the SAME reference.
    rerender(<History />);

    expect(getAllByTestId('workout-row').length).toBe(initialRowCount);
    expect(mockWorkoutViewRenderSpy.mock.calls.length).toBe(rendersBefore);
  });

  it('shows the English empty-state copy (AGENTS.md: app language is English only)', () => {
    mockUseWorkoutsByFilters.mockReturnValue([]);
    const {getByText, queryByText} = render(<History />);
    expect(getByText('No workouts yet.')).toBeTruthy();
    // Guard against accidental reintroduction of the previous German copy.
    expect(queryByText('Noch keine Trainings vorhanden.')).toBeNull();
  });

  it('renders TrainingElementPicker in the list container', () => {
    mockUseWorkoutsByFilters.mockReturnValue([1, 2]);
    const {getByTestId} = render(<History />);
    expect(getByTestId('training-element-picker')).toBeTruthy();
  });

  // GH-452: the History picker only offers exercises and muscles — its label must
  // say exactly that instead of inheriting the "Metrics, Accumulation Mode" default.
  it('labels the picker with only the selectable options (exercises and muscles)', () => {
    mockUseWorkoutsByFilters.mockReturnValue([1, 2]);
    const {getByTestId} = render(<History />);
    const picker = getByTestId('training-element-picker');
    expect(picker.props.accessibilityLabel).toBe('Select Exercises, Muscles');
    expect(picker.props.accessibilityLabel).not.toMatch(/Metric|Accumulation/);
    // No metric / accumulation options are wired into the History picker.
    expect(picker.props.accessibilityHint).toBe('');
  });

  it('shows no-match message when filters are active but no workouts match', () => {
    // Simulate: filters are active (route exercise pre-selects id 42) but hook returns empty
    mockUseRoute.mockReturnValue({params: {exercise: {id: 42, name: 'Squat'}}} as any);
    mockUseWorkoutsByFilters.mockReturnValue([]);
    const {getByTestId, queryByTestId} = render(<History />);
    // The container is rendered (not the global empty state) with the filter section
    expect(getByTestId('history-list-container')).toBeTruthy();
    expect(getByTestId('history-filters-empty')).toBeTruthy();
    expect(queryByTestId('history-empty-state')).toBeNull();
  });
});

describe('History tab — Dashboard exercise drill-down', () => {
  it('pre-selects the route exercise so useWorkoutsByFilters is called with that exercise id', () => {
    mockUseRoute.mockReturnValue({params: {exercise: {id: 7, name: 'Bench Press'}}} as any);
    mockUseWorkoutsByFilters.mockReturnValue([11, 10]);

    render(<History />);

    // On initial mount, useWorkoutsByFilters must be called with the route exercise
    // pre-selected in the exerciseIds array and no muscle filters.
    expect(mockUseWorkoutsByFilters).toHaveBeenCalledWith([], [7]);
  });

  it('shows the drilled-down exercise workouts when an exercise param is present', () => {
    mockUseRoute.mockReturnValue({params: {exercise: {id: 7, name: 'Bench Press'}}} as any);
    mockUseWorkoutsByFilters.mockReturnValue([12, 11]);

    const {getAllByTestId} = render(<History />);
    const rows = getAllByTestId('workout-row').map((r) => r.props.children);
    expect(rows).toEqual([12, 11]);
  });

  it('re-syncs chip selection when Dashboard re-navigates with a different exercise param', () => {
    // Mount with exercise A (id: 7)
    mockUseRoute.mockReturnValue({params: {exercise: {id: 7, name: 'Bench Press'}}} as any);
    mockUseWorkoutsByFilters.mockReturnValue([11, 10]);

    const {rerender} = render(<History />);
    expect(mockUseWorkoutsByFilters).toHaveBeenCalledWith([], [7]);

    // Simulate Dashboard re-navigating with exercise B (id: 42)
    mockUseRoute.mockReturnValue({params: {exercise: {id: 42, name: 'Squat'}}} as any);

    act(() => {
      rerender(<History />);
    });

    // Must now filter by exercise B, NOT exercise A
    expect(mockUseWorkoutsByFilters).toHaveBeenLastCalledWith([], [42]);
  });

  it('keeps current chip selection when re-navigating without an exercise param', () => {
    // Mount with exercise A (id: 7) — user has a chip selected
    mockUseRoute.mockReturnValue({params: {exercise: {id: 7, name: 'Bench Press'}}} as any);
    mockUseWorkoutsByFilters.mockReturnValue([11, 10]);

    const {rerender} = render(<History />);
    expect(mockUseWorkoutsByFilters).toHaveBeenCalledWith([], [7]);

    // Simulate arriving via Drawer (no exercise param) — chips must not be cleared
    mockUseRoute.mockReturnValue({params: undefined} as any);

    act(() => {
      rerender(<History />);
    });

    // Chip selection must still be [7] (not cleared)
    expect(mockUseWorkoutsByFilters).toHaveBeenLastCalledWith([], [7]);
  });

  it('resets muscle filters when Dashboard drill-down arrives with a new exercise', () => {
    mockUseRoute.mockReturnValue({params: {exercise: {id: 7, name: 'Bench Press'}}} as any);
    mockUseWorkoutsByFilters.mockReturnValue([11, 10]);

    const {rerender} = render(<History />);

    // Simulate the user setting a muscle filter manually via the picker
    act(() => {
      capturedSetMuscle!(['Quadriceps']);
    });

    expect(mockUseWorkoutsByFilters).toHaveBeenLastCalledWith(['Quadriceps'], [7]);

    // Dashboard navigates to a different exercise — muscles must be cleared
    mockUseRoute.mockReturnValue({params: {exercise: {id: 42, name: 'Squat'}}} as any);
    act(() => {
      rerender(<History />);
    });

    expect(mockUseWorkoutsByFilters).toHaveBeenLastCalledWith([], [42]);
  });
});
