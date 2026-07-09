import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {VideoAnalysisRepResult} from '../../models/entities/VideoAnalysis';

interface Props {
  repResults1: VideoAnalysisRepResult[];
  repResults2: VideoAnalysisRepResult[];
  onRepPress?: (repIndex: number) => void;
  highlightedRepIndex?: number;
}

const fmt = (value: number | undefined | null, decimals = 0): string => {
  if (value == null) {
    return '—';
  }
  return value.toFixed(decimals);
};

const fmtDelta = (a: number | undefined, b: number | undefined, decimals = 0): string => {
  if (a == null || b == null) {
    return '—';
  }
  const delta = b - a;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(decimals)}`;
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

const CompareRepSummary = ({repResults1, repResults2, onRepPress, highlightedRepIndex}: Props) => {
  const theme = useTheme();
  const repCount = Math.min(repResults1.length, repResults2.length);

  if (repCount === 0) {
    return (
      <View style={styles.empty}>
        <Text>No rep data available for comparison.</Text>
      </View>
    );
  }

  return (
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
              <Text style={styles.cell}>{fmt(r1?.vAvg)}</Text>
              <Text style={styles.cell}>{fmt(r2?.vAvg)}</Text>
              <Text style={[styles.cell, styles.deltaCell]}>{fmtDelta(r1?.vAvg, r2?.vAvg)}</Text>
              <Text style={styles.cell}>{fmt(r1?.vPeak)}</Text>
              <Text style={styles.cell}>{fmt(r2?.vPeak)}</Text>
              <Text style={[styles.cell, styles.deltaCell]}>{fmtDelta(r1?.vPeak, r2?.vPeak)}</Text>
              <Text style={styles.cell}>{fmtMs(r1?.totalTimeMs)}</Text>
              <Text style={styles.cell}>{fmtMs(r2?.totalTimeMs)}</Text>
              <Text style={[styles.cell, styles.deltaCell]}>{fmtMsDelta(r1?.totalTimeMs, r2?.totalTimeMs)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
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
});

export default CompareRepSummary;
