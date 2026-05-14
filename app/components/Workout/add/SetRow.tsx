import React from 'react';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import AddWorkoutSet from './AddWorkoutSet';

export interface SetRowProps {
  workoutSet: WorkoutSet;
  setId?: number;
  reps: number;
  weight: number;
  rir: number;
  isDone: boolean;
  isCurrent: boolean;
  date: Date;
  onSubmit: (workoutSet: WorkoutSet) => void;
  onDelete: (workoutSet: WorkoutSet) => void;
}

const SetRowComponent = ({workoutSet, date, onSubmit, onDelete}: SetRowProps) => (
  <AddWorkoutSet workoutSet={workoutSet} onSubmit={onSubmit} onDelete={onDelete} date={date} />
);

export const areSetRowPropsEqual = (previous: SetRowProps, next: SetRowProps) =>
  previous.setId === next.setId &&
  previous.reps === next.reps &&
  previous.weight === next.weight &&
  previous.rir === next.rir &&
  previous.isDone === next.isDone &&
  previous.isCurrent === next.isCurrent &&
  previous.date.getTime() === next.date.getTime() &&
  previous.onSubmit === next.onSubmit &&
  previous.onDelete === next.onDelete;

const SetRow = React.memo(SetRowComponent, areSetRowPropsEqual);

SetRow.displayName = 'SetRow';

export default SetRow;
