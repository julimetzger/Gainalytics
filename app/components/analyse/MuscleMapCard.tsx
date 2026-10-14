import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {Workout} from '../../models/entities/Workout';
import {useSettings} from '../../redux/settings/use/useSettings';
import {dispatchSetPlanMuscleMapMetric} from '../../redux/settings/dispatch/dispatchSetPlanMuscleMap';
import {MuscleMapMetric, aggregateWorkouts, buildCompareRows} from '../../utils/MuscleInvolvementUtils';
import MuscleMapBarList, {MuscleMapDetailLabels, MuscleMapDisplay} from './MuscleMapBarList';

/**
 * The four values a tapped muscle expands to: [plan prev, plan cur, done prev,
 * done cur] — or, for a share, [this plan, this done, micro plan, micro done].
 * The second and the fourth cell carry their delta against the cell before.
 */
export interface MuscleMapDetails {
  labels: MuscleMapDetailLabels;
  workouts: [Workout[] | undefined, Workout[] | undefined, Workout[] | undefined, Workout[] | undefined];
}

interface MuscleMapCardProps {
  subject: Workout[];
  /** Undefined when there is nothing to compare against — only the own values are drawn. */
  reference?: Workout[];
  /** vs Micro: the second segment reads "Share" and the readout is the percentage. */
  share?: boolean;
  /** Legend: the two sides, e.g. `Done` · `Plan`. */
  subjectLabel: string;
  referenceLabel?: string;
  /** Short name of the reference for the column head, e.g. `Plan`, `M1`. */
  referenceShort?: string;
  details: MuscleMapDetails;
  testID: string;
  emptyText?: string;
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

const Segments = <T extends string>({options, value, onChange, testIDPrefix}: {options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; testIDPrefix: string}) => {
  const theme = useTheme();
  return (
    <View style={[styles.segments, {borderColor: theme.colors.outlineVariant}]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`${testIDPrefix}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{selected}}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && {backgroundColor: theme.colors.secondaryContainer}]}
          >
            <Text style={[styles.segmentLabel, {color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface}]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const METRIC_OPTIONS: SegmentOption<MuscleMapMetric>[] = [
  {value: 'sets', label: 'Sets'},
  {value: 'volume', label: 'Volume'},
];

const selectExercisesById = (state: GlobalState) => state.exercises.byId;

/**
 * GH-526 — the one muscle map of every overview and analysis. It compares
 * exactly the two workout lists it is given, the same lists the KPI cards and
 * the Muscle Overview below it use, so all of them share one reference.
 */
const MuscleMapCard = ({subject, reference, share = false, subjectLabel, referenceLabel, referenceShort, details, testID, emptyText = 'No muscle data yet.'}: MuscleMapCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const setMetric = dispatchSetPlanMuscleMapMetric();
  const exercisesById = useSelector(selectExercisesById) ?? {};
  const metric: MuscleMapMetric = settings?.plan?.muscleMap?.metric === 'volume' ? 'volume' : 'sets';
  const [view, setView] = useState<'total' | 'diff'>('total');
  const hasReference = reference !== undefined;
  const display: MuscleMapDisplay = view === 'total' ? 'total' : share ? 'share' : 'diff';

  const rows = useMemo(() => {
    const totals = (workouts?: Workout[]) => (workouts ? aggregateWorkouts(workouts, exercisesById, metric) : undefined);
    const [w0, w1, w2, w3] = details.workouts;
    return buildCompareRows(totals(subject)!, totals(reference), {planPrev: totals(w0), planCur: totals(w1), donePrev: totals(w2), doneCur: totals(w3)}, share);
  }, [subject, reference, details.workouts, exercisesById, metric, share]);

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;
  const muted = theme.colors.onSurfaceVariant;
  const track = (theme.colors as unknown as {surfaceContainerHighest?: string}).surfaceContainerHighest ?? theme.colors.surfaceVariant;

  let columnHead = '';
  if (hasReference) {
    if (display === 'total') columnHead = `${subjectLabel}/${referenceShort ?? referenceLabel}`;
    else if (display === 'diff') columnHead = `Δ vs ${referenceShort ?? referenceLabel}`;
    else columnHead = `% of ${referenceLabel}`;
  }

  return (
    <View testID={testID} style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <View style={styles.headerRow}>
        <Text variant="titleMedium" style={styles.title}>
          Muscle Map
        </Text>
        {hasReference && (
          <Segments
            testIDPrefix={`${testID}-view`}
            value={view}
            onChange={setView}
            options={[
              {value: 'total', label: 'Total'},
              {value: 'diff', label: share ? 'Share' : 'Diff'},
            ]}
          />
        )}
        <Segments testIDPrefix={`${testID}-metric`} value={metric} onChange={setMetric} options={METRIC_OPTIONS} />
      </View>

      {display === 'total' && (
        <View style={styles.legendRow} testID={`${testID}-legend`}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, {backgroundColor: theme.colors.primary}]} />
            <Text style={[styles.legendText, {color: muted}]}>{subjectLabel}</Text>
          </View>
          {hasReference && (
            <View style={styles.legendItem}>
              <View style={[styles.swatch, {backgroundColor: track, borderColor: theme.colors.outline, borderWidth: 1}]} />
              <Text style={[styles.legendText, {color: muted}]}>{referenceLabel}</Text>
            </View>
          )}
          <Text style={[styles.legendText, styles.columnHead, {color: muted}]} numberOfLines={1}>
            {columnHead}
          </Text>
        </View>
      )}
      {display === 'diff' && (
        <View style={styles.legendRow} testID={`${testID}-legend`}>
          <Text style={[styles.legendText, styles.less, {color: muted}]}>less</Text>
          <Text style={[styles.legendText, styles.more, {color: muted}]}>more</Text>
          <Text style={[styles.legendText, styles.diffHead, {color: muted}]} numberOfLines={1}>
            {columnHead}
          </Text>
        </View>
      )}
      {display === 'share' && (
        <View style={styles.legendRow} testID={`${testID}-legend`}>
          <Text style={[styles.legendText, styles.flex, {color: muted}]} numberOfLines={1}>{`${subjectLabel} · share of ${referenceLabel}`}</Text>
          <Text style={[styles.legendText, {color: muted}]}>{columnHead}</Text>
        </View>
      )}

      {rows.length === 0 ? (
        <Text testID={`${testID}-empty`} style={[styles.hint, {color: muted}]}>
          {emptyText}
        </Text>
      ) : (
        <MuscleMapBarList rows={rows} metric={metric} view={display} hasReference={hasReference} detailLabels={details.labels} testIDPrefix={`${testID}-row`} />
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
    gap: 6,
  },
  title: {
    flex: 1,
    fontWeight: '500',
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
  },
  columnHead: {
    flex: 1,
    textAlign: 'right',
  },
  less: {
    flex: 1,
    paddingLeft: 84,
  },
  more: {
    flex: 1,
    textAlign: 'right',
  },
  diffHead: {
    width: 84,
    textAlign: 'right',
  },
  flex: {
    flex: 1,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 4,
  },
});

export default MuscleMapCard;
