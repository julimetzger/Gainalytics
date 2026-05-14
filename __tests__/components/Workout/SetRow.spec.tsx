import React from 'react';
import {render} from '@testing-library/react-native';
import SetRow, {SetRowProps} from '../../../app/components/Workout/add/SetRow';

const mockAddWorkoutSetRender = jest.fn();

jest.mock('../../../app/components/Workout/add/AddWorkoutSet', () => {
  const React = require('react');
  const {Text} = require('react-native');

  return function MockAddWorkoutSet(props: {workoutSet?: {index?: number; reps?: number}}) {
    mockAddWorkoutSetRender(props);
    return <Text testID={`set-row-${props.workoutSet?.index}`}>{props.workoutSet?.reps}</Text>;
  };
});

describe('SetRow', () => {
  const date = new Date('2026-05-11T10:00:00.000Z');
  const workoutSet = {
    index: 1,
    reps: 5,
    rir: 2,
    weight: 100,
    date,
  };

  beforeEach(() => {
    mockAddWorkoutSetRender.mockClear();
  });

  it('skips rendering when row-driving props and callbacks are unchanged', () => {
    const onSubmit = jest.fn();
    const onDelete = jest.fn();
    const props = {
      workoutSet,
      setId: workoutSet.index,
      reps: workoutSet.reps,
      weight: workoutSet.weight,
      rir: workoutSet.rir,
      isDone: true,
      isCurrent: false,
      date,
      onSubmit,
      onDelete,
    } satisfies SetRowProps;

    const {rerender} = render(<SetRow {...props} />);

    rerender(<SetRow {...props} workoutSet={{...workoutSet}} />);

    expect(mockAddWorkoutSetRender).toHaveBeenCalledTimes(1);
  });

  it('renders again when a row-driving value changes', () => {
    const onSubmit = jest.fn();
    const onDelete = jest.fn();
    const props = {
      workoutSet,
      setId: workoutSet.index,
      reps: workoutSet.reps,
      weight: workoutSet.weight,
      rir: workoutSet.rir,
      isDone: true,
      isCurrent: false,
      date,
      onSubmit,
      onDelete,
    } satisfies SetRowProps;

    const {rerender} = render(<SetRow {...props} />);
    const changedSet = {...workoutSet, reps: 6};

    rerender(<SetRow {...props} workoutSet={changedSet} reps={changedSet.reps} />);

    expect(mockAddWorkoutSetRender).toHaveBeenCalledTimes(2);
  });
});
