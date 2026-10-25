import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Training} from '../../../models/entities/Training';
import {TrainingsState} from '../../../models/TrainingsState';
import {getLocalMicro, getPreviousMicroInMeso} from '../../../redux/Training/trainingsPlanReducer';
import VelocityLossInsightCard from '../VelocityLossInsightCard';
import {useVelocityLossInsights} from '../useVelocityLossInsights';
import CoachInsightCard from '../CoachInsightCard';
import {Stage} from '../../common/ProgressiveMount';
import CompareChips, {CompareChipOption} from '../../analyse/CompareChips';
import ComparisonKpiCards from '../../analyse/ComparisonKpiCards';
import MuscleMapCard, {MuscleMapDetails} from '../../analyse/MuscleMapCard';
import {countKpi, doneWorkoutIdsOf, durationKpi, Kpi, plannedWorkoutIdsOf, setsKpi, setsOf, trainingDurationMs, volumeKpi} from '../../../utils/overview-comparison';

interface TrainingsBaseProps {
  trainingsPlan: TrainingsPlan;
  micro: number;
  /** Pass false when this pane is off-screen (swiper) to suppress API calls. */
  isActive?: boolean;
}

/** GH-526 — the references of the Total tab: done vs the previous micro's done, or done vs this micro's plan. */
export type MicroTotalCompare = 'previous' | 'plan';

const totalDurationMs = (trainings: Training[]) => trainings.reduce((total, training) => total + (training.end ? trainingDurationMs(training) : 0), 0);

/**
 * The Total tab of the micro Overview. GH-526: what was trained in this micro,
 * compared against one reference picked with the chips — the previous micro's
 * trained load (default, the historical behaviour) or this micro's plan. The
 * line under the chips names both sides; KPI cards, muscle map and Muscle
 * Overview all use the same reference.
 */
const MicroOverview = ({trainingsPlan, micro, isActive = true}: TrainingsBaseProps) => {
  const theme = useTheme();
  const previousMicro = getPreviousMicroInMeso(trainingsPlan.mesos, micro);
  const vlInsights = useVelocityLossInsights(trainingsPlan, micro);
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  const previousTrainings = useAllTrainingsInMicro(trainingsPlan.id!!, previousMicro ?? -1);

  const doneCur = useWorkoutsByIds(useMemo(() => doneWorkoutIdsOf(trainings), [trainings]));
  const planCur = useWorkoutsByIds(useMemo(() => plannedWorkoutIdsOf(trainings), [trainings]));
  const donePrev = useWorkoutsByIds(useMemo(() => doneWorkoutIdsOf(previousTrainings), [previousTrainings]));
  const planPrev = useWorkoutsByIds(useMemo(() => plannedWorkoutIdsOf(previousTrainings), [previousTrainings]));

  const localMicro = getLocalMicro(trainingsPlan.mesos, micro);
  const previousLocalMicro = previousMicro !== undefined ? getLocalMicro(trainingsPlan.mesos, previousMicro) : undefined;
  const available: Record<MicroTotalCompare, boolean> = {
    previous: previousMicro !== undefined && setsOf(donePrev) > 0,
    plan: setsOf(planCur) > 0,
  };
  const options: CompareChipOption<MicroTotalCompare>[] = [
    {value: 'previous', label: previousLocalMicro !== undefined ? `vs Micro ${previousLocalMicro}` : 'vs previous micro', disabled: !available.previous},
    {value: 'plan', label: 'vs Plan', disabled: !available.plan},
  ];
  const [chosen, setChosen] = useState<MicroTotalCompare>('previous');
  const selected: MicroTotalCompare | undefined = available[chosen] ? chosen : options.find((option) => !option.disabled)?.value;

  let reference = undefined as typeof doneCur | undefined;
  let comparisonLine = `Micro ${localMicro} (done) · no reference available`;
  let subjectLabel = `Micro ${localMicro}`;
  let referenceLabel: string | undefined;
  const kpis: Kpi[] = [];
  if (selected === 'previous') {
    reference = donePrev;
    comparisonLine = `Micro ${localMicro} (done) vs Micro ${previousLocalMicro} (done)`;
    referenceLabel = `Micro ${previousLocalMicro}`;
    kpis.push(durationKpi(totalDurationMs(trainings), totalDurationMs(previousTrainings)));
  } else if (selected === 'plan') {
    reference = planCur;
    comparisonLine = `Micro ${localMicro} done vs Micro ${localMicro} plan`;
    subjectLabel = 'Done';
    referenceLabel = 'Plan';
    const finished = trainings.filter((training) => training.state === TrainingsState.FINISHED).length;
    const planned = trainings.filter((training) => Object.keys(training.plannedWorkouts ?? {}).length > 0).length;
    kpis.push(countKpi('trainings', 'Trainings', finished, planned));
  } else {
    kpis.push(durationKpi(totalDurationMs(trainings), undefined));
  }
  kpis.push(setsKpi(doneCur, reference), volumeKpi(doneCur, reference));

  const previousShort = previousLocalMicro !== undefined ? `M${previousLocalMicro}` : '–';
  const details = useMemo<MuscleMapDetails>(
    () => ({
      labels: [`Plan ${previousShort}`, `Plan M${localMicro}`, `Done ${previousShort}`, `Done M${localMicro}`],
      workouts: [previousMicro !== undefined ? planPrev : undefined, planCur, previousMicro !== undefined ? donePrev : undefined, doneCur],
    }),
    [previousShort, localMicro, previousMicro, planPrev, planCur, donePrev, doneCur],
  );

  // No inner ScrollView here: this renders inside TrainingsPlanNode's
  // NestableScrollContainer; a nested same-direction ScrollView clips the
  // content and blocks scrolling (GH-382).
  return (
    <View testID="micro-total-overview">
      <CompareChips options={options} value={selected} onChange={setChosen} testIDPrefix="micro-compare" />
      <Text testID="micro-comparison-line" variant="bodySmall" style={[styles.line, {color: theme.colors.onSurfaceVariant}]}>
        {comparisonLine}
      </Text>
      <ComparisonKpiCards kpis={kpis} testIDPrefix="micro-total" />
      {/* PERF-003: the sections below the summary cards arrive in later stages when the view builds
          progressively (see ProgressiveMount); everywhere else all stages are on at once. */}
      <Stage at={1}>
        <MuscleMapCard
          testID="micro-muscle-map"
          subject={doneCur}
          reference={reference}
          subjectLabel={subjectLabel}
          referenceLabel={referenceLabel}
          details={details}
          emptyText="Nothing trained in this micro yet."
        />
        {vlInsights.length > 0 && (
          <View style={{marginTop: 4}}>
            {vlInsights.map((insight) => (
              <VelocityLossInsightCard
                key={insight.exerciseId}
                exerciseName={insight.exerciseName}
                heaviestWeightKg={insight.heaviestWeightKg}
                currentVlPercent={insight.currentVlPercent}
                vlRirEstimate={insight.vlRirEstimate}
                reportedRir={insight.reportedRir}
                microHistory={insight.microHistory}
                currentMicro={micro}
                vlReference={insight.vlReference}
              />
            ))}
          </View>
        )}
        <CoachInsightCard trainings={trainings} isActive={isActive} />
      </Stage>
      <Stage at={3}>
        <MetricsOverviewForWorkouts trainingsWorkouts={doneCur} previousWorkouts={reference ?? []} referenceLabel={referenceLabel} />
      </Stage>
    </View>
  );
};

const styles = StyleSheet.create({
  line: {
    marginHorizontal: 13,
    marginTop: 6,
  },
});

export default MicroOverview;
