import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Icon, Text, useTheme} from 'react-native-paper';
import {MuscleCompareRow, MuscleMapMetric, formatMetricDiff, formatMetricValue, formatShare} from '../../utils/MuscleInvolvementUtils';

/**
 * GH-526 — how the bars read:
 * - 'total' — value bar over the reference bar, a marker at the reference; readout `10/14`
 * - 'diff'  — diverging bar around a centre line (left = less, right = more); readout `+2`
 * - 'share' — the value as a share of the reference (vs the whole micro); readout `21%`
 */
export type MuscleMapDisplay = 'total' | 'diff' | 'share';

/** Labels of the four values a tapped muscle expands to: [plan prev, plan cur, done prev, done cur]. */
export type MuscleMapDetailLabels = [string, string, string, string];

interface MuscleMapBarListProps {
  rows: MuscleCompareRow[];
  metric: MuscleMapMetric;
  view: MuscleMapDisplay;
  /** False when nothing is compared — only the own values are drawn. */
  hasReference: boolean;
  detailLabels: MuscleMapDetailLabels;
  /** testID prefix of every row: `<prefix>-<muscle>`, `-readout`, `-detail`. */
  testIDPrefix?: string;
}

const BAR_HEIGHT = 16;
const LABEL_WIDTH = 76;
const READOUT_WIDTH = 64;

const ratio = (value: number, max: number) => `${Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100}%` as const;

const sortRows = (rows: MuscleCompareRow[], view: MuscleMapDisplay, hasReference: boolean): MuscleCompareRow[] => {
  const sorted = [...rows];
  if (view === 'diff' && hasReference) {
    // biggest shortfall first
    sorted.sort((a, b) => a.value - a.reference - (b.value - b.reference) || a.label.localeCompare(b.label));
  } else if (view === 'share' && hasReference) {
    sorted.sort((a, b) => (b.reference > 0 ? b.value / b.reference : 0) - (a.reference > 0 ? a.value / a.reference : 0) || a.label.localeCompare(b.label));
  } else {
    sorted.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }
  return sorted;
};

/**
 * Per-muscle bars of the shared muscle map card (GH-300, reworked in GH-526):
 * the readout carries exactly one thing per view, and a tap on a row expands
 * the four values behind it — plan and done of the reference period and of
 * this one.
 */
const MuscleMapBarList = ({rows, metric, view, hasReference, detailLabels, testIDPrefix = 'muscle-row'}: MuscleMapBarListProps) => {
  const theme = useTheme();
  const colors = theme.colors as typeof theme.colors & {surfaceContainerHighest?: string; surfaceContainerHigh?: string};
  const track = colors.surfaceContainerHighest ?? theme.colors.elevation?.level3 ?? theme.colors.surfaceVariant;
  const cellBackground = colors.surfaceContainerHigh ?? theme.colors.elevation?.level2 ?? theme.colors.surfaceVariant;
  const [openMuscle, setOpenMuscle] = useState<string | undefined>(undefined);

  const sorted = useMemo(() => sortRows(rows, view, hasReference), [rows, view, hasReference]);
  const maxTotal = useMemo(() => Math.max(0, ...rows.flatMap((row) => [row.value, hasReference ? row.reference : 0])), [rows, hasReference]);
  const maxDiff = useMemo(() => Math.max(0, ...rows.map((row) => Math.abs(row.value - row.reference))), [rows]);

  const diffColor = (difference: number) => (Math.round(difference * 10) === 0 ? theme.colors.onSurfaceVariant : difference > 0 ? theme.colors.primary : theme.colors.error);

  return (
    <View>
      {sorted.map((row) => {
        const id = `${testIDPrefix}-${row.muscleGroupId}`;
        const difference = row.value - row.reference;
        const open = openMuscle === row.muscleGroupId;

        let readout = formatMetricValue(row.value, metric);
        let readoutColor = theme.colors.onSurface;
        if (hasReference) {
          if (view === 'total') readout = `${formatMetricValue(row.value, metric)}/${formatMetricValue(row.reference, metric)}`;
          else if (view === 'diff') {
            readout = formatMetricDiff(difference, metric);
            readoutColor = diffColor(difference);
          } else readout = formatShare(row.value, row.reference);
        }

        const {planPrev, planCur, donePrev, doneCur} = row.detail;
        const cells: {label: string; value?: number; reference?: number}[] = [
          {label: detailLabels[0], value: planPrev},
          {label: detailLabels[1], value: planCur, reference: planPrev},
          {label: detailLabels[2], value: donePrev},
          {label: detailLabels[3], value: doneCur, reference: donePrev},
        ];

        return (
          <View key={row.muscleGroupId} style={[styles.rowWrap, {borderTopColor: theme.colors.outlineVariant}]}>
            <Pressable
              testID={id}
              accessibilityRole="button"
              accessibilityState={{expanded: open}}
              onPress={() => setOpenMuscle(open ? undefined : row.muscleGroupId)}
              style={styles.row}
            >
              <Text style={[styles.rowLabel, {color: theme.colors.onSurface}]} numberOfLines={1}>
                {row.label}
              </Text>
              <View style={[styles.barContainer, {height: BAR_HEIGHT}]}>
                {(!hasReference || view === 'total') && (
                  <>
                    {hasReference && <View testID={`${id}-reference-bar`} style={[styles.fill, {width: ratio(row.reference, maxTotal), backgroundColor: track, borderRadius: 4}]} />}
                    <View
                      testID={`${id}-value-bar`}
                      style={[styles.fill, hasReference ? styles.inset : null, {width: ratio(row.value, maxTotal), backgroundColor: theme.colors.primary, borderRadius: 3}]}
                    />
                    {hasReference && row.reference > 0 && <View style={[styles.marker, {left: ratio(row.reference, maxTotal), backgroundColor: theme.colors.onSurfaceVariant}]} />}
                  </>
                )}
                {hasReference && view === 'diff' && (
                  <View style={styles.diverging}>
                    <View style={[styles.half, styles.leftHalf, {borderRightColor: theme.colors.outline}]}>
                      {difference < 0 && <View testID={`${id}-less-bar`} style={[styles.diffBar, styles.lessBar, {width: ratio(-difference, maxDiff), backgroundColor: theme.colors.error}]} />}
                    </View>
                    <View style={styles.half}>
                      {difference > 0 && <View testID={`${id}-more-bar`} style={[styles.diffBar, styles.moreBar, {width: ratio(difference, maxDiff), backgroundColor: theme.colors.primary}]} />}
                    </View>
                  </View>
                )}
                {hasReference && view === 'share' && (
                  <View style={[styles.fill, styles.shareTrack, {right: 0, backgroundColor: track}]}>
                    <View testID={`${id}-share-bar`} style={[styles.fill, {width: ratio(row.value, row.reference), backgroundColor: theme.colors.primary, borderRadius: 4}]} />
                  </View>
                )}
              </View>
              <Text testID={`${id}-readout`} style={[styles.readout, {color: readoutColor}]} numberOfLines={1}>
                {readout}
              </Text>
              <Icon source={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.onSurfaceVariant} />
            </Pressable>
            {open && (
              <View testID={`${id}-detail`} style={styles.detailGrid}>
                {cells.map((cell, index) => {
                  const delta = cell.value !== undefined && cell.reference !== undefined ? cell.value - cell.reference : undefined;
                  return (
                    <View key={index} style={[styles.cell, {backgroundColor: cellBackground}]}>
                      <Text style={[styles.cellLabel, {color: theme.colors.onSurfaceVariant}]} numberOfLines={1}>
                        {cell.label}
                      </Text>
                      <Text testID={`${id}-detail-${index}`} style={styles.cellValue}>
                        {cell.value === undefined ? '–' : formatMetricValue(cell.value, metric)}
                      </Text>
                      {delta !== undefined && (
                        <Text style={[styles.cellDelta, {color: diffColor(delta)}]}>{formatMetricDiff(delta, metric)}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  rowWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: {
    width: LABEL_WIDTH,
    fontSize: 12,
  },
  barContainer: {
    flex: 1,
    position: 'relative',
    marginHorizontal: 8,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  inset: {
    top: 3,
    bottom: 3,
  },
  marker: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 2,
    marginLeft: -1,
  },
  diverging: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  half: {
    flex: 1,
    flexDirection: 'row',
  },
  leftHalf: {
    justifyContent: 'flex-end',
    borderRightWidth: 1,
  },
  diffBar: {
    height: '100%',
  },
  lessBar: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  moreBar: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  shareTrack: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  readout: {
    // minWidth, not width: `10.4/10.4` or `14.7t/11.9t` must never be ellipsized — the bar yields instead.
    minWidth: READOUT_WIDTH,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    fontFamily: 'monospace',
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 5,
    paddingBottom: 10,
  },
  cell: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    gap: 2,
  },
  cellLabel: {
    fontSize: 11,
  },
  cellValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cellDelta: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});

export default MuscleMapBarList;
