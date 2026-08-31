import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {MuscleMapCompare, MuscleMapMetric} from '../settingsReducer';

export const dispatchSetPlanMuscleMapMetric = () => {
  const dispatch = useDispatch();

  return (metric: MuscleMapMetric) =>
    dispatch({
      type: 'SET_PLAN_MUSCLE_MAP_METRIC',
      metric,
    } as Action & {metric: MuscleMapMetric});
};

export const dispatchSetPlanMuscleMapCompare = () => {
  const dispatch = useDispatch();

  return (compare: MuscleMapCompare) =>
    dispatch({
      type: 'SET_PLAN_MUSCLE_MAP_COMPARE',
      compare,
    } as Action & {compare: MuscleMapCompare});
};

export const dispatchSetAnalyseMuscleMapCompare = () => {
  const dispatch = useDispatch();

  return (compare: MuscleMapCompare) =>
    dispatch({
      type: 'SET_ANALYSE_MUSCLE_MAP_COMPARE',
      compare,
    } as Action & {compare: MuscleMapCompare});
};
