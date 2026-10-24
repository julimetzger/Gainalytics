import {TrainingsState} from '../TrainingsState';

export type Training = {
  id?: number;
  doneWorkoutIds: {[exerciseId: number]: number};
  plannedWorkouts: {[exerciseId: number]: number};
  exercises: number[];
  notes?: String;
  start?: Date;
  end?: Date;
  state: TrainingsState;
  /**
   * GH-496: start times (epoch ms) of further Strong CSV sessions merged into this
   * training because they were on the same day — a re-import recognises them by these.
   */
  mergedSessionStarts?: number[];
};
