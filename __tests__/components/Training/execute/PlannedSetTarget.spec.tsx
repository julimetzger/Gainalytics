import React from 'react';
import {render} from '@testing-library/react-native';
import PlannedSetTarget, {resolvePlannedSetForIndex} from '../../../../app/components/Training/execute/PlannedSetTarget';
import {Workout} from '../../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-63: the training screen shows the planned set as a readable target,
// including its range. Display only — nothing here prefills the actual input.

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

describe('resolvePlannedSetForIndex', () => {
  it('picks the set matching the next index', () => {
    expect(resolvePlannedSetForIndex(sets, 2)).toEqual(sets[1]);
  });

  it('falls back to the last planned set beyond the plan', () => {
    expect(resolvePlannedSetForIndex(sets, 7)).toEqual(sets[1]);
  });

  it('clamps to the first planned set when the plan indices start above 1', () => {
    const shifted: WorkoutSet[] = [
      {index: 8, reps: 8, rir: 1, weight: 100, repsMax: 12},
      {index: 9, reps: 6, rir: 2, weight: 120},
    ];
    expect(resolvePlannedSetForIndex(shifted, 1)).toEqual(shifted[0]);
  });

  it('returns nothing when no set is planned', () => {
    expect(resolvePlannedSetForIndex([], 1)).toEqual(undefined);
  });
});

describe('PlannedSetTarget', () => {
  it('renders the ranged target of the upcoming set', () => {
    const {getByTestId} = render(<PlannedSetTarget plannedWorkout={plannedWorkout} nextSetIndex={1} />);
    expect({
      label: getByTestId('planned-set-target-label').props.children,
      value: getByTestId('planned-set-target-value').props.children,
    }).toEqual({label: 'Target · Set 1', value: '8-12 reps · RIR 1-3 · 100-110 kg'});
  });

  it('renders a fixed target exactly as before, without any range notation', () => {
    const {getByTestId} = render(<PlannedSetTarget plannedWorkout={plannedWorkout} nextSetIndex={2} />);
    expect({
      label: getByTestId('planned-set-target-label').props.children,
      value: getByTestId('planned-set-target-value').props.children,
    }).toEqual({label: 'Target · Set 2', value: '6 reps · RIR 2 · 120 kg'});
  });

  it('renders nothing when the exercise has no planned workout', () => {
    const {queryByTestId} = render(<PlannedSetTarget plannedWorkout={undefined} nextSetIndex={1} />);
    expect(queryByTestId('planned-set-target')).toEqual(null);
  });
});
