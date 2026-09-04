import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import DropdownChip, {DropdownChipOption} from '../../shared/DropdownChip';
import {useLastMatchingTrainingMicro, useMuscleInvolvement} from '../../../redux/Training/use/useMuscleInvolvement';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {useTrainingsPlan} from '../../../redux/Training/use/useTrainingsPlan';
import {
  dispatchSetAnalyseMuscleMapCompare,
  dispatchSetPlanMuscleMapCompare,
  dispatchSetPlanMuscleMapMetric,
} from '../../../redux/settings/dispatch/dispatchSetPlanMuscleMap';
import {MuscleMapCompare, MuscleMapMetric, MuscleMapView} from '../../../utils/MuscleInvolvementUtils';
import MuscleMapBarList from '../../analyse/MuscleMapBarList';

interface MuscleInvolvementCardProps {
  trainingsPlanId: number;
  micro: number;
  trainingInMicro: number;
  /** 'plan' (default) — today subject is the planned workouts; 'analyse' — today subject is the done workouts. */
  view?: MuscleMapView;
  /** Training is still in progress (GH-367) — swaps the 'analyse' header label from "done" to "live". */
  isLive?: boolean;
}

const METRIC_OPTIONS: DropdownChipOption<MuscleMapMetric>[] = [
  {value: 'sets', label: 'Sets'},
  {value: 'volume', label: 'Volume'},
];

const VALID_COMPARES: MuscleMapCompare[] = ['none', 'last_plan', 'current_total_plan', 'last_training_plan', 'last_training_done'];

const normalizeCompare = (raw: unknown, fallback: MuscleMapCompare): MuscleMapCompare => {
  if (typeof raw === 'string' && (VALID_COMPARES as string[]).includes(raw)) return raw as MuscleMapCompare;
  return fallback;
};

const trainingNameFor = (trainingNames: {[k: string]: string} | undefined, trainingInMicro: number): string => {
  const explicit = trainingNames?.[trainingInMicro];
  if (explicit && explicit.trim().length > 0) return explicit;
  return `Training ${trainingInMicro + 1}`;
};

const compareLabel = (
  compare: MuscleMapCompare,
  micro: number,
  trainingName: string,
  lastPlannedMicro: number | undefined,
  lastDoneMicro: number | undefined,
): string => {
  if (compare === 'none') return 'None';
  if (compare === 'current_total_plan') return 'Current micro plan';
  if (compare === 'last_plan') {
    const previous = Math.max(1, micro - 1);
    return `Micro ${previous} plan`;
  }
  if (compare === 'last_training_plan') {
    if (lastPlannedMicro === undefined) return `Last ${trainingName} plan`;
    return `Micro ${lastPlannedMicro} · ${trainingName} (plan)`;
  }
  if (compare === 'last_training_done') {
    if (lastDoneMicro === undefined) return `Last ${trainingName} done`;
    return `Micro ${lastDoneMicro} · ${trainingName} (done)`;
  }
  return '';
};

const MuscleInvolvementCard = ({trainingsPlanId, micro, trainingInMicro, view = 'plan', isLive = false}: MuscleInvolvementCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const plan = useTrainingsPlan(trainingsPlanId);
  const setMetric = dispatchSetPlanMuscleMapMetric();
  const setPlanCompare = dispatchSetPlanMuscleMapCompare();
  const setAnalyseCompare = dispatchSetAnalyseMuscleMapCompare();

  const metric: MuscleMapMetric = settings.plan?.muscleMap?.metric === 'volume' ? 'volume' : 'sets';

  // GH-436: both positions of the analysis view compare against the micro's total
  // plan unless the user picked something else — the choice is persisted per view
  // (plan / analyse), so it survives toggling positions, sub-tabs and micros.
  const fallbackCompare: MuscleMapCompare = 'current_total_plan';
  const persistedCompare = view === 'analyse' ? settings.muscleMapCompareSelectionAnalyse : settings.muscleMapCompareSelectionPlan ?? settings.plan?.muscleMap?.compare;
  const setCompare = view === 'analyse' ? setAnalyseCompare : setPlanCompare;
  const compare: MuscleMapCompare = normalizeCompare(persistedCompare, fallbackCompare);

  const trainingName = trainingNameFor(plan?.trainingNames, trainingInMicro);
  const previousMicroAvailable = micro >= 2;

  const lastPlannedMicro = useLastMatchingTrainingMicro(trainingsPlanId, trainingInMicro, micro, false);
  const lastDoneMicro = useLastMatchingTrainingMicro(trainingsPlanId, trainingInMicro, micro, true);

  const compareOptions = useMemo<DropdownChipOption<MuscleMapCompare>[]>(() => {
    const options: DropdownChipOption<MuscleMapCompare>[] = [
      {value: 'none', label: 'None'},
      {value: 'current_total_plan', label: 'Current micro plan'},
      {
        value: 'last_plan',
        label: previousMicroAvailable ? `Micro ${micro - 1} plan` : 'No previous plan',
        disabled: !previousMicroAvailable,
      },
      {
        value: 'last_training_plan',
        label: lastPlannedMicro !== undefined ? `Micro ${lastPlannedMicro} · ${trainingName} (plan)` : `Last ${trainingName} (plan)`,
        disabled: lastPlannedMicro === undefined,
      },
    ];
    if (lastDoneMicro !== undefined) {
      options.push({
        value: 'last_training_done',
        label: `Micro ${lastDoneMicro} · ${trainingName} (done)`,
      });
    }
    return options;
  }, [micro, previousMicroAvailable, lastPlannedMicro, lastDoneMicro, trainingName]);

  // If the persisted compare is 'last_training_done' but no done match exists in the
  // current context, fall back to 'current_total_plan' which is always in compareOptions.
  // Using fallbackCompare here was wrong: in analyse view fallbackCompare itself is
  // 'last_training_done', which is NOT added to compareOptions when lastDoneMicro is
  // undefined — causing the DropdownChip to receive a value outside its options list.
  const effectiveSelectedCompare: MuscleMapCompare = compare === 'last_training_done' && lastDoneMicro === undefined ? 'current_total_plan' : compare;

  const data = useMuscleInvolvement({trainingsPlanId, micro, trainingInMicro, metric, compare: effectiveSelectedCompare, view});

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;

  const showReferenceLayer = data.effectiveCompare !== 'none';

  // GH-436: the header names the subject's scope so the card can never be read as
  // a micro-wide map (the Overview's MicroMuscleMapCard says "THIS MICRO").
  const headerLabel = view === 'analyse' ? (isLive ? 'THIS TRAINING (LIVE)' : 'THIS DONE TRAINING') : 'THIS TRAINING (PLANNED)';

  return (
    <View testID={view === 'analyse' ? 'muscle-involvement-card-analyse' : 'muscle-involvement-card'} style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerLabel, {color: onSurfaceVariant}]}>{headerLabel}</Text>
          <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>·</Text>
          <DropdownChip<MuscleMapMetric>
            testID="muscle-map-metric-chip"
            value={metric}
            options={METRIC_OPTIONS}
            onChange={setMetric}
          />
          <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>vs</Text>
          <DropdownChip<MuscleMapCompare>
            testID={view === 'analyse' ? 'muscle-map-compare-chip-analyse' : 'muscle-map-compare-chip'}
            value={effectiveSelectedCompare}
            options={compareOptions}
            onChange={setCompare}
          />
        </View>
      </View>

      <Text testID="muscle-map-compare-label" style={[styles.compareLabel, {color: onSurfaceVariant}]}>
        {compareLabel(data.effectiveCompare, micro, trainingName, lastPlannedMicro, lastDoneMicro)}
      </Text>

      {data.referenceUnavailable && (
        <Text testID="muscle-map-no-reference" style={[styles.hint, {color: onSurfaceVariant}]}>
          No reference available — showing this training only.
        </Text>
      )}

      {data.rows.length === 0 ? (
        <Text testID="muscle-map-empty" style={[styles.hint, {color: onSurfaceVariant}]}>
          No muscle data for this training yet.
        </Text>
      ) : (
        <MuscleMapBarList rows={data.rows} globalMax={data.globalMax} metric={metric} showReferenceLayer={showReferenceLayer} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
    padding: 12,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerSeparator: {
    fontSize: 11,
    opacity: 0.7,
  },
  compareLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 6,
    marginLeft: 2,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
});

export default MuscleInvolvementCard;
