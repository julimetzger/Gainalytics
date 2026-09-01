import React from 'react';
import {render} from '@testing-library/react-native';
import PlannedSetTarget, {resolveNextPlannedSet, resolveNextSetNumber} from '../../../../app/components/Training/execute/PlannedSetTarget';
import {Workout} from '../../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-63: the training screen shows the planned set as a readable target,
// including its range. Display only — nothing here prefills the actual input.
//
// Round 2 (PR #429 review): the target has to name the NEXT OPEN planned set,
// driven purely by which planned indices are already logged. Anything that
// derives the number from a set COUNT breaks as soon as the planned indices do
// not start at 1 or have a hole in them.

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {
    Icon: () => null,
    Text,
    useTheme: () => ({
      colors: {
        onSurface: '#ffffff',
        onSurfaceVariant: '#cccccc',
        primary: '#3366ff',
      },
    }),
  };
});

const sets: WorkoutSet[] = [
  {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110},
  {index: 2, reps: 6, rir: 2, weight: 120},
];

const plannedWorkout = {id: 5, exerciseId: 1, sets} as Workout;

const banner = (workout: Workout | undefined, loggedSetIndices: number[]) => {
  const {getByTestId} = render(<PlannedSetTarget plannedWorkout={workout} loggedSetIndices={loggedSetIndices} />);
  return {
    label: getByTestId('planned-set-target-label').props.children,
    value: getByTestId('planned-set-target-value').props.children,
  };
};

describe('resolveNextPlannedSet', () => {
  it('picks the FIRST planned set while nothing is logged', () => {
    expect(resolveNextPlannedSet(sets, [])).toEqual(sets[0]);
  });

  it('advances to the next planned set after the first one is logged', () => {
    expect(resolveNextPlannedSet(sets, [1])).toEqual(sets[1]);
  });

  it('returns nothing once every planned set is logged', () => {
    expect(resolveNextPlannedSet(sets, [1, 2])).toEqual(undefined);
  });

  it('does not care about the order the sets are stored in', () => {
    expect(resolveNextPlannedSet([sets[1], sets[0]], [])).toEqual(sets[0]);
  });

  it('works for plans whose indices do not start at 1', () => {
    const shifted: WorkoutSet[] = [
      {index: 8, reps: 8, rir: 1, weight: 100, repsMax: 12},
      {index: 9, reps: 6, rir: 2, weight: 120},
    ];
    expect(resolveNextPlannedSet(shifted, [])).toEqual(shifted[0]);
    expect(resolveNextPlannedSet(shifted, [8])).toEqual(shifted[1]);
    expect(resolveNextPlannedSet(shifted, [8, 9])).toEqual(undefined);
  });

  it('skips the hole left by a deleted middle set instead of jumping to the end', () => {
    // Four sets were planned, the second one deleted -> indices 1, 3 and 4.
    // The last index differs from the next open one, so this fails for any
    // implementation that falls back to "the last planned set".
    const withGap: WorkoutSet[] = [
      {index: 1, reps: 8, rir: 1, weight: 100},
      {index: 3, reps: 5, rir: 0, weight: 140},
      {index: 4, reps: 3, rir: 0, weight: 160},
    ];
    expect(resolveNextPlannedSet(withGap, [])).toEqual(withGap[0]);
    expect(resolveNextPlannedSet(withGap, [1])).toEqual(withGap[1]);
    expect(resolveNextPlannedSet(withGap, [1, 3])).toEqual(withGap[2]);
  });

  it('returns nothing when no set is planned', () => {
    expect(resolveNextPlannedSet([], [])).toEqual(undefined);
  });
});

describe('resolveNextSetNumber', () => {
  it('is the next open planned index, not the number of sets in play', () => {
    expect(resolveNextSetNumber(sets, [])).toEqual(1);
    expect(resolveNextSetNumber(sets, [1])).toEqual(2);
  });

  it('continues after the highest number once the plan is worked off', () => {
    expect(resolveNextSetNumber(sets, [1, 2])).toEqual(3);
  });

  it('keeps the plan numbering when the plan does not start at 1', () => {
    const shifted: WorkoutSet[] = [
      {index: 8, reps: 8, rir: 1, weight: 100},
      {index: 9, reps: 6, rir: 2, weight: 120},
    ];
    expect(resolveNextSetNumber(shifted, [])).toEqual(8);
    expect(resolveNextSetNumber(shifted, [8])).toEqual(9);
    expect(resolveNextSetNumber(shifted, [8, 9])).toEqual(10);
  });

  it('fills the hole of a deleted middle set before continuing', () => {
    const withGap: WorkoutSet[] = [
      {index: 1, reps: 8, rir: 1, weight: 100},
      {index: 3, reps: 5, rir: 0, weight: 140},
      {index: 4, reps: 3, rir: 0, weight: 160},
    ];
    expect(resolveNextSetNumber(withGap, [1])).toEqual(3);
    expect(resolveNextSetNumber(withGap, [1, 3])).toEqual(4);
    expect(resolveNextSetNumber(withGap, [1, 3, 4])).toEqual(5);
  });
});

describe('PlannedSetTarget', () => {
  it('names the FIRST planned set while nothing is logged', () => {
    expect(banner(plannedWorkout, [])).toEqual({label: 'Target · Set 1', value: '8-12 reps · RIR 1-3 · 100-110 kg'});
  });

  it('advances to the next planned set after one set is logged', () => {
    expect(banner(plannedWorkout, [1])).toEqual({label: 'Target · Set 2', value: '6 reps · RIR 2 · 120 kg'});
  });

  it('reports the plan as worked off after the last planned set', () => {
    expect(banner(plannedWorkout, [1, 2])).toEqual({label: 'Target', value: 'All 2 planned sets logged'});
  });

  it('stays on the first planned set when the plan starts above 1', () => {
    const shifted = {id: 6, exerciseId: 1, sets: [
      {index: 8, reps: 8, rir: 1, weight: 100, repsMax: 12},
      {index: 9, reps: 6, rir: 2, weight: 120},
    ]} as Workout;
    expect(banner(shifted, [])).toEqual({label: 'Target · Set 8', value: '8-12 reps · RIR 1 · 100 kg'});
    expect(banner(shifted, [8])).toEqual({label: 'Target · Set 9', value: '6 reps · RIR 2 · 120 kg'});
  });

  it('renders a fixed target exactly as before, without any range notation', () => {
    const fixedOnly = {id: 7, exerciseId: 1, sets: [{index: 1, reps: 6, rir: 2, weight: 120}]} as Workout;
    expect(banner(fixedOnly, [])).toEqual({label: 'Target · Set 1', value: '6 reps · RIR 2 · 120 kg'});
  });

  it('renders nothing when the exercise has no planned workout', () => {
    const {queryByTestId} = render(<PlannedSetTarget plannedWorkout={undefined} loggedSetIndices={[]} />);
    expect(queryByTestId('planned-set-target')).toEqual(null);
  });

  it('renders nothing when the planned workout has no sets', () => {
    const {queryByTestId} = render(<PlannedSetTarget plannedWorkout={{id: 8, exerciseId: 1, sets: []} as Workout} loggedSetIndices={[]} />);
    expect(queryByTestId('planned-set-target')).toEqual(null);
  });
});
