import React, {useMemo, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {Icon, SegmentedButtons, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {Accumulation} from '../../picker/elements/TrainingElementPicker';
import {buildHeatmapModel, buildMuscleLaneModel, countRecordsThisWeek, statusLine, unitForAccumulation} from '../../../utils/RecordsAnalysis';
import RecordsHeatmap from './RecordsHeatmap';
import RecordsMuscleLanes from './RecordsMuscleLanes';

const mono = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

interface Props {
  recordWorkouts: Workout[];
  exercises: Exercise[];
  rangeStart: Date;
  rangeEnd: Date;
  accumulation?: Accumulation;
  now: Date;
}

const RecordsOverTimeCard = ({recordWorkouts, exercises, rangeStart, rangeEnd, accumulation, now}: Props) => {
  const theme = useTheme();
  const [view, setView] = useState<'heatmap' | 'muscle'>('heatmap');

  const unit = unitForAccumulation(accumulation);
  const heatmap = useMemo(() => buildHeatmapModel(recordWorkouts, rangeStart, rangeEnd, accumulation), [recordWorkouts, rangeStart, rangeEnd, accumulation]);
  const lanes = useMemo(() => buildMuscleLaneModel(recordWorkouts, exercises, rangeStart, rangeEnd, accumulation), [recordWorkouts, exercises, rangeStart, rangeEnd, accumulation]);
  const thisWeek = useMemo(() => countRecordsThisWeek(recordWorkouts, now), [recordWorkouts, now]);

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;

  return (
    <View testID="records-over-time-card" style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, {color: theme.colors.onSurface}]}>Records over time</Text>
        <Text testID="records-mode-caption" style={[styles.caption, {color: theme.colors.onSurfaceVariant, fontFamily: mono}]}>
          by {unit}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Icon source="trending-up" size={16} color={theme.colors.primary} />
        <Text testID="records-status-line" style={[styles.statusText, {color: theme.colors.primary}]}>
          {statusLine(thisWeek)}
        </Text>
      </View>
      <SegmentedButtons
        value={view}
        onValueChange={(value) => setView(value as 'heatmap' | 'muscle')}
        style={styles.segmented}
        buttons={[
          {value: 'heatmap', label: 'Heatmap', icon: 'view-grid-outline', testID: 'records-view-heatmap'},
          {value: 'muscle', label: 'By muscle', icon: 'chart-bar', testID: 'records-view-muscle'},
        ]}
      />
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text testID="records-kpi-total" style={[styles.kpiValue, {color: theme.colors.onSurface, fontFamily: mono}]}>
            {recordWorkouts.length}
          </Text>
          <Text style={[styles.kpiLabel, {color: theme.colors.onSurfaceVariant}]}>records</Text>
        </View>
        <View style={styles.kpi}>
          <Text testID="records-kpi-best" style={[styles.kpiValue, {color: theme.colors.onSurface, fontFamily: mono}]}>
            {heatmap.bestCount}
          </Text>
          <Text style={[styles.kpiLabel, {color: theme.colors.onSurfaceVariant}]}>best {unit}</Text>
        </View>
        <View style={styles.kpi}>
          <Text testID="records-kpi-week" style={[styles.kpiValue, {color: theme.colors.onSurface, fontFamily: mono}]}>
            {thisWeek}
          </Text>
          <Text style={[styles.kpiLabel, {color: theme.colors.onSurfaceVariant}]}>this week</Text>
        </View>
      </View>
      {view === 'heatmap' ? <RecordsHeatmap model={heatmap} /> : <RecordsMuscleLanes model={lanes} />}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 12,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  caption: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmented: {
    marginTop: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    marginVertical: 14,
  },
  kpi: {
    flex: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  kpiLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default RecordsOverTimeCard;
