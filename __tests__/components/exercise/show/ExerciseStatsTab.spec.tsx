import React from 'react';
import {render} from '@testing-library/react-native';
import ExerciseStatsTab from '../../../../app/components/exercise/show/ExerciseStatsTab';
import {Record} from '../../../../app/models/entities/Exercise';
import {useExercise} from '../../../../app/redux/Exercises/use/useExercise';
import {useWorkoutsByIds} from '../../../../app/redux/Workout/use/useWorkoutsByIds';
import {Workout} from '../../../../app/models/entities/Workout';

jest.mock('../../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));
jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  const Card = ({children}: any) => <View>{children}</View>;
  Card.Title = ({title, subtitle}: any) => (
    <View>
      <Text>{title}</Text>
      {subtitle ? <Text>{subtitle}</Text> : null}
    </View>
  );
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Card,
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({colors: {onSurface: '#000', onSurfaceVariant: '#666', outlineVariant: '#ccc', primaryContainer: '#eef'}}),
  };
});

const mockedUseExercise = jest.mocked(useExercise);
const mockedUseWorkoutsByIds = jest.mocked(useWorkoutsByIds);

describe('ExerciseStatsTab', () => {
  it('renders rep estimates when current 1RM exists', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [{value: 120, workoutId: 1}],
      },
    });
    const workouts: Workout[] = [
      {
        id: 1,
        exerciseId: 2,
        sets: [{index: 1, reps: 5, rir: 1, weight: 90, record: [Record.ONE_RM]}],
        start: new Date(2024, 0, 2),
        records: {[Record.ONE_RM]: 120},
      },
    ];
    mockedUseWorkoutsByIds.mockReturnValue(workouts);

    const {getByText, queryAllByText} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);

    expect(getByText('Rep estimates')).toBeTruthy();
    expect(getByText('1 reps')).toBeTruthy();
    expect(getByText('5 reps')).toBeTruthy();
    expect(queryAllByText(/120\.0 kg/).length).toBeGreaterThan(0);
    expect(queryAllByText(/102\.9 kg/).length).toBeGreaterThan(0);
  });

  it('shows fallback text when no current 1RM data is available', () => {
    mockedUseExercise.mockReturnValue({id: 2, name: 'Bench', records: {}});
    mockedUseWorkoutsByIds.mockReturnValue([]);

    const {getByText} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);
    expect(getByText('No current 1RM data available.')).toBeTruthy();
    expect(getByText('No records found.')).toBeTruthy();
  });

  it('renders records flat-sorted with the highest value at the top, including string-coerced values', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [
          // Persisted records can hold stringified numbers (toFixed(2) in
          // legacy reducer). Numeric coercion is mandatory before sorting.
          {value: '180.00' as unknown as number, workoutId: 3},
          {value: 200, workoutId: 1},
          {value: '195.00' as unknown as number, workoutId: 2},
        ],
      },
    });
    const workouts: Workout[] = [
      {
        id: 1,
        exerciseId: 2,
        sets: [{index: 2, reps: 1, rir: 0, weight: 200, record: [Record.ONE_RM]}],
        start: new Date(2024, 0, 1),
      },
      {
        id: 2,
        exerciseId: 2,
        sets: [{index: 1, reps: 2, rir: 1, weight: 190, record: [Record.ONE_RM]}],
        start: new Date(2024, 0, 5),
      },
      {
        id: 3,
        exerciseId: 2,
        sets: [{index: 1, reps: 3, rir: 2, weight: 175, record: [Record.ONE_RM]}],
        start: new Date(2024, 0, 8),
      },
    ];
    mockedUseWorkoutsByIds.mockReturnValue(workouts);

    const {getByTestId} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);

    const list = getByTestId('one-rm-records-list');
    const rowTextOf = (idx: number): string => {
      const row = getByTestId(`one-rm-record-row-${idx}`);
      const collect = (node: any): string => {
        if (typeof node === 'string') return node;
        if (typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(collect).join(' ');
        if (node && node.props && node.props.children !== undefined) return collect(node.props.children);
        return '';
      };
      return collect(row);
    };
    expect(list).toBeTruthy();
    expect(rowTextOf(0)).toMatch(/200\.0/);
    expect(rowTextOf(0)).toContain('Set 2');
    expect(rowTextOf(1)).toMatch(/195\.0/);
    expect(rowTextOf(2)).toMatch(/180\.0/);
  });

  it('renders SET/REPS/RIR from the producing set even when no set is tagged with Record.ONE_RM (GH-264)', () => {
    // Persisted data never tags `set.record` — only `Workout.records[ONE_RM]`
    // (a number) and `Exercise.records[ONE_RM]` ({value, workoutId}) are written
    // by the reducer. The render path must therefore identify the producing set
    // by picking the set with the highest individual 1RM.
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [{value: 150, workoutId: 10}],
      },
    });
    const workouts: Workout[] = [
      {
        id: 10,
        exerciseId: 2,
        // Mixed set strengths — set #3 (140 kg × 4 reps @ 1 RIR) produces the
        // highest individual 1RM, so SET / REPS / RIR should pick it up.
        sets: [
          {index: 1, reps: 8, rir: 3, weight: 100},
          {index: 2, reps: 6, rir: 2, weight: 120},
          {index: 3, reps: 4, rir: 1, weight: 140},
          {index: 4, reps: 6, rir: 3, weight: 110},
        ],
        start: new Date(2024, 0, 12),
      },
    ];
    mockedUseWorkoutsByIds.mockReturnValue(workouts);

    const {getByTestId} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);

    const rowTextOf = (idx: number): string => {
      const row = getByTestId(`one-rm-record-row-${idx}`);
      const collect = (node: any): string => {
        if (typeof node === 'string') return node;
        if (typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(collect).join(' ');
        if (node && node.props && node.props.children !== undefined) return collect(node.props.children);
        return '';
      };
      return collect(row);
    };

    const text = rowTextOf(0);
    expect(text).toContain('Set 3');
    // Reps and RIR from the producing set, not '—'
    expect(text).toMatch(/(^|\s)4(\s|$)/);
    expect(text).toMatch(/(^|\s)1(\s|$)/);
    expect(text).not.toContain('—');
  });

  it('renders SET/REPS/RIR as "—" when the source workout has no sets (e.g. deleted)', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [{value: 150, workoutId: 99}],
      },
    });
    // No matching workout returned by useWorkoutsByIds — simulates a record
    // pointing at a workout that was later deleted.
    mockedUseWorkoutsByIds.mockReturnValue([]);

    const {getByTestId} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);

    const row = getByTestId('one-rm-record-row-0');
    const collect = (node: any): string => {
      if (typeof node === 'string') return node;
      if (typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(collect).join(' ');
      if (node && node.props && node.props.children !== undefined) return collect(node.props.children);
      return '';
    };
    const text = collect(row);
    // 1RM still rendered, but SET / REPS / RIR fall back to '—' three times.
    expect(text).toMatch(/150\.0/);
    expect((text.match(/—/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('skips records with non-numeric values entirely (does not render "—" rows)', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [
          {value: 200, workoutId: 1},
          {value: 'NaN' as unknown as number, workoutId: 2},
          {value: null as unknown as number, workoutId: 3},
        ],
      },
    });
    const workouts: Workout[] = [
      {
        id: 1,
        exerciseId: 2,
        sets: [{index: 1, reps: 1, rir: 0, weight: 200, record: [Record.ONE_RM]}],
        start: new Date(2024, 0, 1),
      },
    ];
    mockedUseWorkoutsByIds.mockReturnValue(workouts);

    const {queryAllByTestId} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);
    const rows = queryAllByTestId(/^one-rm-record-row-/);
    expect(rows).toHaveLength(1);
  });
});
