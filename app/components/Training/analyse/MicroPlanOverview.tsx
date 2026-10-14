import {Stage} from '../../common/ProgressiveMount';
import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Training} from '../../../models/entities/Training';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {getLocalMicro, getPreviousMicroInMeso} from '../../../redux/Training/trainingsPlanReducer';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import ComparisonKpiCards from '../../analyse/ComparisonKpiCards';
import MuscleMapCard, {MuscleMapDetails} from '../../analyse/MuscleMapCard';
import {setsKpi, setsOf, volumeKpi} from '../../../utils/overview-comparison';

interface MicroPlanOverviewProps {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

const plannedIdsOf = (trainings: Training[]) => trainings.flatMap((training) => (training.plannedWorkouts ? (Object.values(training.plannedWorkouts) as number[]) : []));
const doneIdsOf = (trainings: Training[]) => trainings.flatMap((training) => (training.doneWorkoutIds ? (Object.values(training.doneWorkoutIds) as number[]) : []));

/**
 * The Plan tab of the micro Overview (GH-417 / GH-436). GH-526: one fixed
 * comparison — this micro's plan vs the previous micro's plan ("did the plan
 * progress?"). Done vs plan lives in the Total tab, so there is no compare
 * selection here.
 *
 * No inner ScrollView here: this renders inside TrainingsPlanNode's scroll
 * container and a nested same-direction ScrollView clips the content (GH-382).
 */
const MicroPlanOverview = ({trainingsPlan, micro}: MicroPlanOverviewProps) => {
  const theme = useTheme();
  const previousMicro = getPreviousMicroInMeso(trainingsPlan.mesos, micro);
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  const previousTrainings = useAllTrainingsInMicro(trainingsPlan.id!!, previousMicro ?? -1);
  const planCur = useWorkoutsByIds(useMemo(() => plannedIdsOf(trainings), [trainings]));
  const doneCur = useWorkoutsByIds(useMemo(() => doneIdsOf(trainings), [trainings]));
  const planPrev = useWorkoutsByIds(useMemo(() => plannedIdsOf(previousTrainings), [previousTrainings]));
  const donePrev = useWorkoutsByIds(useMemo(() => doneIdsOf(previousTrainings), [previousTrainings]));

  const localMicro = getLocalMicro(trainingsPlan.mesos, micro);
  const previousLocalMicro = previousMicro !== undefined ? getLocalMicro(trainingsPlan.mesos, previousMicro) : undefined;
  const hasReference = previousMicro !== undefined && setsOf(planPrev) > 0;
  const reference = hasReference ? planPrev : undefined;
  const subjectLabel = `Plan M${localMicro}`;
  const referenceLabel = hasReference ? `Plan M${previousLocalMicro}` : undefined;
  const totalPlannedSets = setsOf(planCur);

  const previousShort = previousLocalMicro !== undefined ? `M${previousLocalMicro}` : '–';
  const details = useMemo<MuscleMapDetails>(
    () => ({
      labels: [`Plan ${previousShort}`, `Plan M${localMicro}`, `Done ${previousShort}`, `Done M${localMicro}`],
      workouts: [previousMicro !== undefined ? planPrev : undefined, planCur, previousMicro !== undefined ? donePrev : undefined, doneCur],
    }),
    [previousShort, localMicro, previousMicro, planPrev, planCur, donePrev, doneCur],
  );

  return (
    <View testID="micro-plan-overview">
      <Text testID="micro-plan-comparison-line" variant="titleSmall" style={styles.line}>
        {referenceLabel ? `${subjectLabel} vs ${referenceLabel}` : subjectLabel}
      </Text>
      {!hasReference && totalPlannedSets > 0 && (
        <Text testID="micro-plan-no-reference" variant="bodySmall" style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}>
          No reference available — there is no plan of a previous micro in this meso.
        </Text>
      )}
      {totalPlannedSets === 0 ? (
        // GH-417 AC6: a micro without planned sets must stay a clean, readable
        // screen — not a blank area and not a table of zeroes.
        <View style={styles.emptyBox}>
          <Text testID="micro-plan-overview-empty">Nothing planned in this micro yet — add sets on the Plan tab of a training.</Text>
        </View>
      ) : (
        <View>
          <ComparisonKpiCards kpis={[setsKpi(planCur, reference), volumeKpi(planCur, reference)]} testIDPrefix="micro-plan" />
          <Stage at={1}>
            <MuscleMapCard
              testID="micro-plan-muscle-map"
              subject={planCur}
              reference={reference}
              subjectLabel={subjectLabel}
              referenceLabel={referenceLabel}
              details={details}
              emptyText="No planned muscle data for this micro yet."
            />
          </Stage>
          <Stage at={3}>
            <MetricsOverviewForWorkouts trainingsWorkouts={planCur} previousWorkouts={reference ?? []} referenceLabel={referenceLabel} showExercises={false} />
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
  line: {
    marginHorizontal: 13,
    marginTop: 8,
  },
  hint: {
    marginHorizontal: 13,
    marginTop: 2,
  },
});

export default MicroPlanOverview;
