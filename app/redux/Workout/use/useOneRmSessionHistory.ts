import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';
import {oneRmPerWorkoutValues} from '../../../components/exercise/show/exerciseStats';

const EMPTY: number[] = [];

// GH-477: best e1RM per finished session of one exercise, oldest first. Feeds
// the sparklines on the exercise list and focus cards. `shallowEqual` keeps
// the result stable across store ticks that don't change any value.
export const useOneRmSessionHistory = (exerciseId: number | undefined, max = 12): number[] =>
  useSelector((state: GlobalState) => {
    if (exerciseId === undefined) return EMPTY;
    const ids = state.workouts.byExerciseId?.[exerciseId];
    if (!ids || ids.length === 0) return EMPTY;
    const workouts = ids.map((id) => state.workouts.byId[id]).filter((w): w is Workout => w !== undefined);
    const values = oneRmPerWorkoutValues(workouts, max);
    return values.length === 0 ? EMPTY : values;
  }, shallowEqual);
