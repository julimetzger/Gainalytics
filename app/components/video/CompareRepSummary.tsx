import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {VideoAnalysisRepResult} from '../../models/entities/VideoAnalysis';
import {
  computeVelocityDelta,
  formatVelocityDelta,
  formatVelocityValue,
  velocityUnitFor,
} from '../../utils/videoAnalysisSetAggregates';

interface Props {
  repResults1: VideoAnalysisRepResult[];
  repResults2: VideoAnalysisRepResult[];
  /** Calibration of analysis A; velocities render in m/s when present. */
  metersPerPixel1?: number;
  /** Calibration of analysis B; velocities render in m/s when present. */
  metersPerPixel2?: number;
  onRepPress?: (repIndex: number) => void;
  highlightedRepIndex?: number;
}

const fmtVelocity = (value: number | undefined | null, metersPerPixel?: number): string => {
  if (value == null || value <= 0) {
    return '—';
  }
  return formatVelocityValue(value, metersPerPixel);
};

const fmtVelocityDelta = (
  a: number | undefined,
  b: number | undefined,
  metersPerPixel1?: number,
  metersPerPixel2?: number,
): string => {
  if (a == null || b == null || a <= 0 || b <= 0) {
    return '—';
  }
  const delta = computeVelocityDelta(a, b, metersPerPixel1, metersPerPixel2);
  return delta ? formatVelocityDelta(delta.delta, delta.unit) : '—';
};

const fmtMs = (ms: number | undefined): string => {
  if (ms == null) {
    return '—';
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const fmtMsDelta = (a: number | undefined, b: number | undefined): string => {
  if (a == null || b == null) {
    return '—';
  }
  const delta = (b - a) / 1000;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}s`;
};

const CompareRepSummary = ({repResults1, repResults2, metersPerPixel1, metersPerPixel2, onRepPress, highlightedRepIndex}: Props) => {
  const theme = useTheme();
  const repCount = Math.min(repResults1.length, repResults2.length);

  if (repCount === 0) {
    return (
      <View style={styles.empty}>
        <Text>No rep data available for comparison.</Text>
      </View>
    );
  }

  const unit1 = velocityUnitFor(metersPerPixel1);
  const unit2 = velocityUnitFor(metersPerPixel2);
  const unitsCaption = unit1 === unit2 ? `Velocities in ${unit1}` : `Velocities: A in ${unit1} · B in ${unit2} (Δ not comparable)`;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scroll}>
        <View>
          {/* Header row */}
          <View style={[styles.row, styles.headerRow, {backgroundColor: theme.colors.surfaceVariant}]}>
            <Text style={[styles.cell, styles.repCell, styles.headerText]}>Rep</Text>
            <Text style={[styles.cell, styles.headerText, {color: theme.colors.primary}]}>vAvg A</Text>
            <Text style={[styles.cell, styles.headerText, {color: theme.colors.tertiary}]}>vAvg B</Text>
            <Text style={[styles.cell, styles.headerText]}>ΔvAvg</Text>
            <Text style={[styles.cell, styles.headerText, {color: theme.colors.primary}]}>vPeak A</Text>
            <Text style={[styles.cell, styles.headerText, {color: theme.colors.tertiary}]}>vPeak B</Text>
            <Text style={[styles.cell, styles.headerText]}>ΔvPeak</Text>
            <Text style={[styles.cell, styles.headerText, {color: theme.colors.primary}]}>Dur A</Text>
            <Text style={[styles.cell, styles.headerText, {color: theme.colors.tertiary}]}>Dur B</Text>
            <Text style={[styles.cell, styles.headerText]}>ΔDur</Text>
          </View>
          {/* Data rows */}
          {Array.from({length: repCount}).map((_, i) => {
            const r1 = repResults1[i];
            const r2 = repResults2[i];
            const isHighlighted = highlightedRepIndex === i;
            return (
              <View
                key={i}
                testID={`compare-rep-row-${i}`}
                style={[
                  styles.row,
                  i % 2 === 0 ? styles.evenRow : styles.oddRow,
                  isHighlighted && {backgroundColor: theme.colors.primaryContainer},
                ]}
                // eslint-disable-next-line react/jsx-no-bind
                onTouchEnd={() => onRepPress?.(i)}
              >
                <Text style={[styles.cell, styles.repCell]}>{i + 1}</Text>
                <Text style={styles.cell}>{fmtVelocity(r1?.vAvg, metersPerPixel1)}</Text>
                <Text style={styles.cell}>{fmtVelocity(r2?.vAvg, metersPerPixel2)}</Text>
                <Text style={[styles.cell, styles.deltaCell]}>{fmtVelocityDelta(r1?.vAvg, r2?.vAvg, metersPerPixel1, metersPerPixel2)}</Text>
                <Text style={styles.cell}>{fmtVelocity(r1?.vPeak, metersPerPixel1)}</Text>
                <Text style={styles.cell}>{fmtVelocity(r2?.vPeak, metersPerPixel2)}</Text>
                <Text style={[styles.cell, styles.deltaCell]}>{fmtVelocityDelta(r1?.vPeak, r2?.vPeak, metersPerPixel1, metersPerPixel2)}</Text>
                <Text style={styles.cell}>{fmtMs(r1?.totalTimeMs)}</Text>
                <Text style={styles.cell}>{fmtMs(r2?.totalTimeMs)}</Text>
                <Text style={[styles.cell, styles.deltaCell]}>{fmtMsDelta(r1?.totalTimeMs, r2?.totalTimeMs)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text variant="labelSmall" testID="compare-rep-units-caption" style={[styles.unitsCaption, {color: theme.colors.onSurfaceVariant}]}>
        {unitsCaption}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
  },
  empty: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  headerRow: {
    minHeight: 40,
  },
  evenRow: {
    backgroundColor: 'transparent',
  },
  oddRow: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  cell: {
    width: 60,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  repCell: {
    width: 36,
    fontWeight: 'bold',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 11,
  },
  deltaCell: {
    fontStyle: 'italic',
  },
  unitsCaption: {
    marginTop: 4,
  },
});

export default CompareRepSummary;
