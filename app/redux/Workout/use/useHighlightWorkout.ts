import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {compareArrays} from '../../../utils/ArrayUtils';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from "../../../models/Metric";

export const useHighlightWorkout = (workoutIds: number[], highlightMode?: Metric) =>
  useSelector(
    (state: GlobalState) => {
      let workouts = workoutIds.map((id) => state.workouts.byId[id]).filter((workout): workout is Workout => workout !== undefined);
      let highlighWorkoutIds: number[] = [];
      if (highlightMode !== undefined && highlightMode !== Metric.FREQUENCY) {
        let highlightValue = highlightMode
          ? calculateMetricValue(
              workouts.flatMap((workout: Workout) => workout.sets),
              highlightMode,
            )
          : undefined;
        highlighWorkoutIds = workouts.filter((workout) => calculateMetricValue(workout.sets, highlightMode) === highlightValue).map((workout) => workout.id!!);
      }
      return highlighWorkoutIds;
    },
    (a, b) => {
      return compareArrays(a, b) ?? true;
    },
  );
