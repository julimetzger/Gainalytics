import React, {useMemo} from 'react';
import {View} from 'react-native';
import {Text} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from '../../../models/Metric';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import MicroMuscleMapCard from './MicroMuscleMapCard';
import PlanningOverview from '../plan/PlanningOverview';
import AnalysisTotalSets from './AnalysisTotalSets';

interface MicroPlanOverviewProps {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

/**
 * GH-417 — the "Plan" position of the analysis view: the planned numbers of the
 * current micro plus the muscle map of the planned load. Both used to be hidden
 * behind drawer switches ("Planned Statistics" / "Muscle Map").
 *
 * No inner ScrollView here: this renders inside TrainingsPlanNode's scroll
 * container and a nested same-direction ScrollView clips the content (GH-382).
 */
const MicroPlanOverview = ({trainingsPlan, micro}: MicroPlanOverviewProps) => {
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  const plannedWorkoutIds = trainings.flatMap((training) => (training?.plannedWorkouts ? Object.values(training.plannedWorkouts) : []));
  const plannedWorkouts = useWorkoutsByIds(plannedWorkoutIds);
  const totalPlannedSets = useMemo(() => {
    const sets = plannedWorkouts.flatMap((workout: Workout) => workout.sets ?? []);
    return calculateMetricValue(sets, Metric.SETS) ?? 0;
  }, [plannedWorkouts]);

  return (
    <View testID="micro-plan-overview">
      <AnalysisTotalSets totalSets={totalPlannedSets} scope="planned" />
      {totalPlannedSets === 0 ? (
        // AC6: a micro without planned sets must stay a clean, readable screen —
        // not a blank area and not a table of zeroes.
        <View style={{padding: 24, alignItems: 'center'}}>
          <Text testID="micro-plan-overview-empty">Nothing planned in this micro yet — add sets on the Plan tab.</Text>
        </View>
      ) : (
        <View>
          {trainingsPlan.id !== undefined && <MicroMuscleMapCard trainingsPlanId={trainingsPlan.id} micro={micro} />}
          <PlanningOverview trainingsPlan={trainingsPlan} micro={micro} />
        </View>
      )}
    </View>
  );
};

export default MicroPlanOverview;
