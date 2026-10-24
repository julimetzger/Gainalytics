import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {Training} from '../../../models/entities/Training';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import CollapsibleSection from '../../analyse/CollapsibleSection';
import CompareChips from '../../analyse/CompareChips';
import ComparisonKpiCards from '../../analyse/ComparisonKpiCards';
import MuscleMapCard from '../../analyse/MuscleMapCard';
import {setsKpi, setsOf, volumeKpi} from '../../../utils/overview-comparison';
import {useTrainingComparison} from './useTrainingComparison';

interface TrainingPlanOverviewProps {
  /** Undefined when nothing has been planned for this slot yet. */
  training?: Training;
  trainingsPlan: TrainingsPlan;
  micro: number;
  trainingInMicro: number;
  /** The Plan | Train toggle — GH-526 puts it at the start of the compare chip row. */
  toggle?: React.ReactNode;
}

/**
 * GH-436 — the "Plan" position of a single training's analysis: the planned
 * numbers of THIS training only (the micro-wide view lives in the Overview's
 * Plan tab). GH-526: compared against the last matching training's plan
 * (default) or, as a share, against the plan of the whole micro — picked with
 * the chips next to the Plan | Train toggle and named in the line below them.
 *
 * No inner ScrollView here: this renders inside TrainingsPlanNode's scroll
 * container and a nested same-direction ScrollView clips the content (GH-382).
 */
const TrainingPlanOverview = ({training, trainingsPlan, micro, trainingInMicro, toggle}: TrainingPlanOverviewProps) => {
  const theme = useTheme();
  const comparison = useTrainingComparison(trainingsPlan, micro, trainingInMicro, 'plan', training);
  const totalPlannedSets = setsOf(comparison.subject);
  const mode = comparison.share ? 'share' : 'diff';

  return (
    <View testID="training-plan-overview">
      <CompareChips options={totalPlannedSets === 0 ? [] : comparison.options} value={comparison.selected} onChange={comparison.select} testIDPrefix="analysis-compare">
        {toggle}
      </CompareChips>
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
          <Text testID="analysis-comparison-line" variant="bodySmall" style={[styles.line, {color: theme.colors.onSurfaceVariant}]}>
            {comparison.comparisonLine}
          </Text>
          <ComparisonKpiCards
            testIDPrefix="training-plan-overview"
            kpis={[setsKpi(comparison.subject, comparison.reference, mode, comparison.referenceLabel), volumeKpi(comparison.subject, comparison.reference, mode, comparison.referenceLabel)]}
          />
          {trainingsPlan.id !== undefined && (
            <MuscleMapCard
              testID="analysis-muscle-map"
              subject={comparison.subject}
              reference={comparison.reference}
              share={comparison.share}
              subjectLabel={comparison.share ? 'This training' : comparison.subjectLabel}
              referenceLabel={comparison.referenceLabel}
              referenceShort={comparison.referenceShort}
              details={comparison.details}
              emptyText="No muscle data for this training yet."
            />
          )}
          <CollapsibleSection id="metrics" title="Metrics">
            <MetricsOverviewForWorkouts
              trainingsWorkouts={comparison.subject}
              previousWorkouts={comparison.reference ?? []}
              referenceLabel={comparison.referenceLabel}
              deltaMode={mode}
            />
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
  line: {
    marginHorizontal: 13,
    marginTop: 6,
  },
});

export default TrainingPlanOverview;
