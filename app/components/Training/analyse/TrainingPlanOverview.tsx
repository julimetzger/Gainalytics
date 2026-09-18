import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import {Training} from '../../../models/entities/Training';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from '../../../models/Metric';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import CollapsibleSection from '../../analyse/CollapsibleSection';
import MuscleInvolvementCard from '../plan/MuscleInvolvementCard';
import AnalysisTotalSets from './AnalysisTotalSets';

interface TrainingPlanOverviewProps {
  /** Undefined when nothing has been planned for this slot yet. */
  training?: Training;
  trainingsPlan: TrainingsPlan;
  micro: number;
  trainingInMicro: number;
}

/**
 * GH-436 — the "Plan" position of a single training's analysis: the planned
 * numbers of THIS training only. GH-417 rendered the whole micro's plan here,
 * which read as if the training had 72 planned sets. The micro-wide view now
 * lives in the Overview (MicroPlanOverview); this one mirrors TrainingsOverview
 * (the "Train" position) with planned instead of logged workouts, so the total
 * set count, the muscle map and the metrics all refer to the same training.
 *
 * The muscle map is the shared single-training card in its 'plan' view, whose
 * default reference is the micro's total plan (`current_total_plan`) — the
 * comparison GH-436 asks for without the user having to pick it.
 *
 * No inner ScrollView here: this renders inside TrainingsPlanNode's scroll
 * container and a nested same-direction ScrollView clips the content (GH-382).
 */
const TrainingPlanOverview = ({training, trainingsPlan, micro, trainingInMicro}: TrainingPlanOverviewProps) => {
  const plannedWorkoutIds = useMemo(() => (training?.plannedWorkouts ? (Object.values(training.plannedWorkouts) as number[]) : []), [training?.plannedWorkouts]);
  const plannedWorkouts = useWorkoutsByIds(plannedWorkoutIds);
  const totalPlannedSets = useMemo(() => {
    const sets = plannedWorkouts.flatMap((workout: Workout) => workout.sets ?? []);
    return calculateMetricValue(sets, Metric.SETS) ?? 0;
  }, [plannedWorkouts]);

  return (
    <View testID="training-plan-overview">
      <AnalysisTotalSets totalSets={totalPlannedSets} scope="planned" />
      {totalPlannedSets === 0 ? (
        // A training without planned sets stays a clean, readable screen — no
        // blank area and no table of zeroes.
        <View style={styles.emptyBox}>
          <Text testID="training-plan-overview-empty">
            {training === undefined ? 'Nothing planned for this training yet.' : 'No sets planned for this training yet — add them on the Plan tab.'}
          </Text>
        </View>
      ) : (
        <View>
          {trainingsPlan.id !== undefined && (
            <CollapsibleSection id="muscleMap" title="Muscle Map">
              <MuscleInvolvementCard trainingsPlanId={trainingsPlan.id} micro={micro} trainingInMicro={trainingInMicro} view="plan" />
            </CollapsibleSection>
          )}
          <CollapsibleSection id="metrics" title="Metrics">
            <MetricsOverviewForWorkouts trainingsWorkouts={plannedWorkouts} />
          </CollapsibleSection>
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
});

export default TrainingPlanOverview;
