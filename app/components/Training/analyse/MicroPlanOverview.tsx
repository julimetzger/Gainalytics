import {Stage} from '../../common/ProgressiveMount';
import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from '../../../models/Metric';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import MicroMuscleMapCard from './MicroMuscleMapCard';
import AnalysisTotalSets from './AnalysisTotalSets';

interface MicroPlanOverviewProps {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

/**
 * GH-417 / GH-436 — the "Plan" position of the micro OVERVIEW: the planned
 * numbers of the whole micro plus the muscle map of the planned load, both put
 * next to what was actually trained in the micro. GH-417 first rendered this
 * inside the analysis of a single training, where micro-wide totals read as
 * that training's numbers; GH-436 moved it here.
 *
 * No inner ScrollView here: this renders inside TrainingsPlanNode's scroll
 * container and a nested same-direction ScrollView clips the content (GH-382).
 */
const MicroPlanOverview = ({trainingsPlan, micro}: MicroPlanOverviewProps) => {
  const theme = useTheme();
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  const plannedWorkoutIds = trainings.flatMap((training) => (training?.plannedWorkouts ? Object.values(training.plannedWorkouts) : []));
  const doneWorkoutIds = trainings.flatMap((training) => (training?.doneWorkoutIds ? Object.values(training.doneWorkoutIds) : []));
  const plannedWorkouts = useWorkoutsByIds(plannedWorkoutIds);
  const doneWorkouts = useWorkoutsByIds(doneWorkoutIds);
  const totalPlannedSets = useMemo(() => {
    const sets = plannedWorkouts.flatMap((workout: Workout) => workout.sets ?? []);
    return calculateMetricValue(sets, Metric.SETS) ?? 0;
  }, [plannedWorkouts]);
  const totalDoneSets = useMemo(() => {
    const sets = doneWorkouts.flatMap((workout: Workout) => workout.sets ?? []);
    return calculateMetricValue(sets, Metric.SETS) ?? 0;
  }, [doneWorkouts]);

  return (
    <View testID="micro-plan-overview">
      <AnalysisTotalSets totalSets={totalPlannedSets} scope="planned" />
      <AnalysisTotalSets totalSets={totalDoneSets} scope="done" testID="analysis-total-sets-done" />
      {totalPlannedSets === 0 ? (
        // GH-417 AC6: a micro without planned sets must stay a clean, readable
        // screen — not a blank area and not a table of zeroes.
        <View style={styles.emptyBox}>
          <Text testID="micro-plan-overview-empty">Nothing planned in this micro yet — add sets on the Plan tab of a training.</Text>
        </View>
      ) : (
        <View>
          <Stage at={1}>
            {trainingsPlan.id !== undefined && <MicroMuscleMapCard trainingsPlanId={trainingsPlan.id} micro={micro} />}
            <Text testID="micro-plan-overview-caption" variant="bodySmall" style={[styles.caption, {color: theme.colors.onSurfaceVariant}]}>
              Planned values for this micro, differences against what was trained.
            </Text>
          </Stage>
          <Stage at={3}>
            <MetricsOverviewForWorkouts trainingsWorkouts={plannedWorkouts} previousWorkouts={doneWorkouts} showExercises={false} />
          </Stage>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  caption: {
    marginHorizontal: 12,
    marginTop: 4,
  },
});

export default MicroPlanOverview;
