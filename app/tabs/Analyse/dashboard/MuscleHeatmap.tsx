import React, {useMemo, useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, View} from 'react-native';
import {Button, Card, SegmentedButtons, Text, useTheme} from 'react-native-paper';
import Svg, {Circle, Line, Polygon} from 'react-native-svg';
import {Muscles} from '../../../models/Muscles';
import {Comparison} from '../../../components/analyse/MetricsOverviewForWorkouts';
import {Metric} from '../../../models/Metric';
import {withAlpha} from '../../../utils/colorUtils';
import {useOverviewMuscles} from '../../../redux/settings/use/useMuscles';
import {
  buildMuscleWeekValues,
  calculateMuscleRadarStats,
  currentValue,
  formatDelta,
  formatMetricValue,
  formatSetCount,
  formatSets,
  formatTonnes,
  lastValue,
  niceMax,
  RadarMetric,
} from './muscleRadarStats';

interface MuscleHeatmapProps {
  muscleMetricMap: Map<Muscles, Map<Metric, Comparison>>;
  onMusclePress: (muscle: Muscles) => void;
}

// GH-532: geometry of the design mockup (342 × 300 chart); narrower cards scale it down.
const DESIGN_WIDTH = 342;
const CHART_HEIGHT = 300;
const RADIUS = 92;
const LABEL_RADIUS = 124;
const LABEL_WIDTH = 84;
const LABEL_HEIGHT = 44;
const RINGS = [0.25, 0.5, 0.75, 1];
/** Fewer axes than this draw a line, not an area. */
const MIN_RADAR_AXES = 3;

type ExtendedColors = {primaryContainer: string; onPrimaryContainer: string; surfaceContainerHigh?: string; surfaceContainerHighest?: string};

const MuscleHeatmap = ({muscleMetricMap, onMusclePress}: MuscleHeatmapProps) => {
  const theme = useTheme();
  const colors = theme.colors as typeof theme.colors & ExtendedColors;
  const [metric, setMetric] = useState<RadarMetric>(Metric.SETS);
  const [selected, setSelected] = useState<Muscles | undefined>(undefined);
  const [width, setWidth] = useState(DESIGN_WIDTH);

  // GH-523: one axis per muscle the user shows in overviews.
  const overviewMuscles = useOverviewMuscles();
  const values = useMemo(() => buildMuscleWeekValues(muscleMetricMap, overviewMuscles), [muscleMetricMap, overviewMuscles]);
  const stats = useMemo(() => calculateMuscleRadarStats(values), [values]);

  const max = niceMax(Math.max(...values.map((value) => Math.max(currentValue(value, metric), lastValue(value, metric)))));
  const scale = Math.min(1, width / DESIGN_WIDTH);
  const radius = RADIUS * scale;
  const labelRadius = LABEL_RADIUS * scale;
  const cx = width / 2;
  const cy = CHART_HEIGHT / 2;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / values.length;
  const point = (index: number, r: number) => ({x: cx + r * Math.cos(angle(index)), y: cy + r * Math.sin(angle(index))});
  const toPoints = (rs: number[]) =>
    rs
      .map((r, index) => point(index, r))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  const valueRadius = (value: number) => (radius * Math.min(value, max)) / max;

  const currentRadii = values.map((value) => valueRadius(currentValue(value, metric)));
  const lastRadii = values.map((value) => valueRadius(lastValue(value, metric)));
  const metricName = metric === Metric.SETS ? 'sets' : 'volume';
  const chartLabel =
    `Radar chart of ${metricName} per muscle group, this week vs last week. ` +
    values.map((value) => `${value.muscle} ${formatMetricValue(currentValue(value, metric), metric)} (last week ${formatMetricValue(lastValue(value, metric), metric)})`).join(', ');

  const selectedIndex = selected ? values.findIndex((value) => value.muscle === selected) : -1;
  const selectedValues = selectedIndex >= 0 ? values[selectedIndex] : undefined;
  const selectedDelta = selectedValues ? currentValue(selectedValues, metric) - lastValue(selectedValues, metric) : 0;
  const deltaText = formatDelta(selectedDelta, metric);
  const deltaColor = deltaText.startsWith('+') ? colors.primary : deltaText.startsWith('-') ? colors.error : colors.onSurface;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const toggleSelection = (muscle: Muscles) => setSelected((current) => (current === muscle ? undefined : muscle));

  const pushPull = stats.pushPull;
  const pushPullRatio = pushPull?.ratio !== undefined ? `${pushPull.ratio.toFixed(1)} : 1` : '–';

  return (
    <Card style={styles.card} testID="muscle-heatmap-card">
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text variant="titleMedium">Muscle Groups</Text>
          <View testID="muscle-radar-metric-toggle">
            <SegmentedButtons
              density="small"
              style={styles.toggle}
              value={metric}
              onValueChange={(value) => setMetric(value as RadarMetric)}
              buttons={[
                {value: Metric.SETS, label: 'Sets', testID: 'muscle-radar-metric-sets', style: styles.toggleButton},
                {value: Metric.VOLUME, label: 'Volume', testID: 'muscle-radar-metric-volume', style: styles.toggleButton},
              ]}
            />
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSolid, {backgroundColor: colors.primary}]} />
            <Text style={[styles.legendText, {color: colors.onSurfaceVariant}]}>This week</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDashed, {borderColor: colors.outline}]} />
            <Text style={[styles.legendText, {color: colors.onSurfaceVariant}]}>Last week</Text>
          </View>
        </View>

        {values.length < MIN_RADAR_AXES ? (
          <Text style={[styles.hint, {color: colors.onSurfaceVariant}]} testID="muscle-radar-too-few">
            {`The radar needs at least ${MIN_RADAR_AXES} muscles. Choose them in Settings → Muscles.`}
          </Text>
        ) : (
        <View style={styles.chart} onLayout={onLayout} testID="muscle-radar-chart">
          <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={chartLabel} testID="muscle-radar-svg">
            <Svg width={width} height={CHART_HEIGHT}>
              {RINGS.map((ring) => (
                <Polygon key={ring} points={toPoints(values.map(() => radius * ring))} fill="none" stroke={colors.outlineVariant} strokeWidth={1} />
              ))}
              {values.map((value, index) => {
                const end = point(index, radius);
                const isSelected = index === selectedIndex;
                return (
                  <Line
                    key={value.muscle}
                    x1={cx}
                    y1={cy}
                    x2={end.x}
                    y2={end.y}
                    stroke={isSelected ? colors.primary : colors.outlineVariant}
                    strokeWidth={isSelected ? 1.5 : 1}
                  />
                );
              })}
              <Polygon points={toPoints(lastRadii)} fill="none" stroke={colors.outline} strokeWidth={1.5} strokeDasharray="4 4" />
              <Polygon
                points={toPoints(currentRadii)}
                fill={withAlpha(colors.primary, 0.22)}
                stroke={colors.primary}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {currentRadii.map((r, index) => {
                const p = point(index, r);
                return <Circle key={values[index].muscle} cx={p.x} cy={p.y} r={index === selectedIndex ? 6 : 3.5} fill={colors.primary} />;
              })}
            </Svg>
          </View>
          {values.map((value, index) => {
            const p = point(index, labelRadius);
            const isSelected = index === selectedIndex;
            const formatted = formatMetricValue(currentValue(value, metric), metric);
            return (
              <Pressable
                key={value.muscle}
                testID={`muscle-chip-${value.muscle}`}
                accessibilityRole="button"
                accessibilityLabel={`${value.muscle}, ${metric === Metric.SETS ? formatSetCount(currentValue(value, metric)) : formatted}`}
                accessibilityState={{selected: isSelected}}
                onPress={() => toggleSelection(value.muscle)}
                style={[styles.labelTarget, {left: p.x - LABEL_WIDTH / 2, top: p.y - LABEL_HEIGHT / 2}]}
              >
                <View style={[styles.label, isSelected && {backgroundColor: colors.primaryContainer}]}>
                  <Text style={[styles.labelName, {color: isSelected ? colors.onPrimaryContainer : colors.onSurface}]}>{value.muscle}</Text>
                  <Text style={[styles.labelValue, {color: colors.onSurfaceVariant}]}>{formatted}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        )}

        {selectedValues ? (
          <View style={[styles.selection, {backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant}]} testID="muscle-radar-selection">
            <View style={styles.selectionText}>
              <Text variant="titleMedium" testID="muscle-radar-selection-name">
                {selectedValues.muscle}
              </Text>
              <Text style={[styles.selectionDetail, {color: colors.onSurfaceVariant}]} testID="muscle-radar-selection-detail">
                {`${formatSetCount(selectedValues.sets)} · ${formatTonnes(selectedValues.volume)} · `}
                <Text style={{color: deltaColor}}>{`${deltaText} vs last week`}</Text>
              </Text>
            </View>
            <Button mode="contained" icon="chevron-right" contentStyle={styles.detailsContent} onPress={() => onMusclePress(selectedValues.muscle)} testID="muscle-radar-details-button">
              Details
            </Button>
          </View>
        ) : (
          <Text style={[styles.hint, {color: colors.onSurfaceVariant}]}>Tap a muscle group for details</Text>
        )}

        <View style={styles.tiles}>
          <StatTile
            testID="muscle-radar-tile-most-trained"
            title="Most trained"
            value={stats.mostTrained?.muscle ?? '–'}
            detail={stats.mostTrained ? formatSetCount(stats.mostTrained.sets) : undefined}
          />
          <StatTile
            testID="muscle-radar-tile-lagging"
            title="Lagging"
            value={stats.lagging?.muscle ?? '–'}
            valueColor={stats.lagging ? colors.error : undefined}
            detail={stats.lagging ? formatSetCount(stats.lagging.sets) : undefined}
          />
          <StatTile
            testID="muscle-radar-tile-push-pull"
            title="Push : Pull"
            value={pushPull ? pushPullRatio : '–'}
            detail={pushPull ? `${formatSets(pushPull.push)} / ${formatSetCount(pushPull.pull)}` : undefined}
          />
        </View>
      </Card.Content>
    </Card>
  );
};

interface StatTileProps {
  testID: string;
  title: string;
  value: string;
  valueColor?: string;
  detail?: string;
}

const StatTile = ({testID, title, value, valueColor, detail}: StatTileProps) => {
  const theme = useTheme();
  const colors = theme.colors as typeof theme.colors & ExtendedColors;
  return (
    <View style={[styles.tile, {backgroundColor: colors.surfaceContainerHigh ?? colors.surfaceVariant}]} testID={testID}>
      <Text style={[styles.tileTitle, {color: colors.onSurfaceVariant}]}>{title}</Text>
      <Text style={[styles.tileValue, valueColor ? {color: valueColor} : undefined]} numberOfLines={1} testID={`${testID}-value`}>
        {value}
      </Text>
      {detail !== undefined && (
        <Text style={[styles.tileTitle, {color: colors.onSurfaceVariant}]} numberOfLines={1} testID={`${testID}-detail`}>
          {detail}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  content: {
    paddingTop: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Paper pads every segment by 16 dp; 92 dp per segment keeps "Volume" on one line.
  toggle: {
    width: 184,
  },
  toggleButton: {
    minWidth: 0,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSolid: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendDashed: {
    width: 16,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 12,
  },
  chart: {
    height: CHART_HEIGHT,
  },
  labelTarget: {
    position: 'absolute',
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  labelName: {
    fontSize: 12,
    fontWeight: '500',
  },
  labelValue: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  selectionText: {
    flex: 1,
    gap: 2,
  },
  selectionDetail: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  detailsContent: {
    flexDirection: 'row-reverse',
  },
  hint: {
    fontSize: 12,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    gap: 2,
  },
  tileTitle: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  tileValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default MuscleHeatmap;
