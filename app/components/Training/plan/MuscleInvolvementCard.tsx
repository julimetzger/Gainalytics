import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {IconButton, Text, useTheme} from 'react-native-paper';
import DropdownChip, {DropdownChipOption} from '../../shared/DropdownChip';
import {useLastMatchingTrainingMicro, useMuscleInvolvement} from '../../../redux/Training/use/useMuscleInvolvement';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {useTrainingsPlan} from '../../../redux/Training/use/useTrainingsPlan';
import {
  dispatchSetAnalyseMuscleMapCompare,
  dispatchSetPlanMuscleMapCompare,
  dispatchSetPlanMuscleMapEnabled,
  dispatchSetPlanMuscleMapMetric,
} from '../../../redux/settings/dispatch/dispatchSetPlanMuscleMap';
import {MuscleMapCompare, MuscleMapMetric, MuscleMapView, formatMetricValue} from '../../../utils/MuscleInvolvementUtils';

interface MuscleInvolvementCardProps {
  trainingsPlanId: number;
  micro: number;
  trainingInMicro: number;
  /** 'plan' (default) — today subject is the planned workouts; 'analyse' — today subject is the done workouts. */
  view?: MuscleMapView;
  /** Hide the dismiss (close) button. Set this on the Done-View where the card is permanent. */
  showDismiss?: boolean;
  onDismiss?: () => void;
}

const METRIC_OPTIONS: DropdownChipOption<MuscleMapMetric>[] = [
  {value: 'sets', label: 'Sets'},
  {value: 'volume', label: 'Volume'},
];

const TINT_THRESHOLD = 0.5;
const BAR_HEIGHT = 16;
const LABEL_WIDTH = 76;
const READOUT_WIDTH = 72;

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

const MuscleInvolvementCard = ({trainingsPlanId, micro, trainingInMicro, view = 'plan', showDismiss = true, onDismiss}: MuscleInvolvementCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const plan = useTrainingsPlan(trainingsPlanId);
  const setEnabled = dispatchSetPlanMuscleMapEnabled();
  const setMetric = dispatchSetPlanMuscleMapMetric();
  const setPlanCompare = dispatchSetPlanMuscleMapCompare();
  const setAnalyseCompare = dispatchSetAnalyseMuscleMapCompare();

  const metric: MuscleMapMetric = settings.plan?.muscleMap?.metric === 'volume' ? 'volume' : 'sets';

  const fallbackCompare: MuscleMapCompare = view === 'analyse' ? 'last_training_done' : 'current_total_plan';
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

  const handleDismiss = () => {
    setEnabled(false);
    onDismiss?.();
  };

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;
  const surfaceContainerHighest = (theme.colors as unknown as {surfaceContainerHighest?: string}).surfaceContainerHighest ?? theme.colors.elevation?.level3 ?? theme.colors.surfaceVariant;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;
  const primary = theme.colors.primary;
  const tertiary = theme.colors.tertiary;

  const showReferenceLayer = data.effectiveCompare !== 'none';

  const headerLabel = view === 'analyse' ? 'THIS DONE TRAINING' : 'THIS TRAINING';

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
        {showDismiss && (
          <IconButton
            testID="muscle-map-dismiss"
            icon="close"
            size={20}
            onPress={handleDismiss}
            accessibilityLabel="Dismiss muscle map"
          />
        )}
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
        <View>
          {data.rows.map((row) => {
            const todayRatio = data.globalMax > 0 ? row.today / data.globalMax : 0;
            const refRatio = data.globalMax > 0 ? row.reference / data.globalMax : 0;
            const showThisReference = showReferenceLayer && row.reference > 0;
            const isUnderTarget = showThisReference && row.today < row.reference * TINT_THRESHOLD;
            const todayColor = isUnderTarget ? tertiary : primary;

            const showTicks = showThisReference && metric === 'sets';
            const tickCount = showTicks ? Math.max(0, Math.floor(row.reference) - 1) : 0;

            const readout = showThisReference
              ? `${formatMetricValue(row.today, metric)}/${formatMetricValue(row.reference, metric)}`
              : formatMetricValue(row.today, metric);

            return (
              <View key={row.muscleGroupId} style={styles.row} testID={`muscle-row-${row.muscleGroupId}`}>
                <Text style={[styles.rowLabel, {color: theme.colors.onSurface}]} numberOfLines={1}>
                  {row.label}
                </Text>
                <View style={[styles.barContainer, {height: BAR_HEIGHT}]}>
                  {showThisReference && (
                    <View
                      testID={`muscle-row-${row.muscleGroupId}-reference-bar`}
                      style={[
                        styles.referenceBar,
                        {width: `${Math.max(0, Math.min(1, refRatio)) * 100}%`, backgroundColor: surfaceContainerHighest},
                      ]}
                    />
                  )}
                  {showTicks && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.tickContainer,
                        {width: `${Math.max(0, Math.min(1, refRatio)) * 100}%`},
                      ]}
                    >
                      {Array.from({length: tickCount}).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.tick,
                            {
                              left: `${((i + 1) / row.reference) * 100}%`,
                              backgroundColor: onSurfaceVariant,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                  <View
                    testID={`muscle-row-${row.muscleGroupId}-today-bar`}
                    style={[
                      styles.todayBar,
                      {
                        width: `${Math.max(0, Math.min(1, todayRatio)) * 100}%`,
                        backgroundColor: todayColor,
                      },
                    ]}
                  />
                </View>
                <View style={styles.readoutContainer}>
                  <Text style={[styles.readout, {color: theme.colors.onSurface}]} numberOfLines={1}>
                    {readout}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    width: LABEL_WIDTH,
    fontSize: 12,
  },
  barContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    marginHorizontal: 8,
    overflow: 'hidden',
    borderRadius: 4,
  },
  referenceBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  todayBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  tickContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  readoutContainer: {
    width: READOUT_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  readout: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontFamily: 'monospace',
  },
});

export default MuscleInvolvementCard;
