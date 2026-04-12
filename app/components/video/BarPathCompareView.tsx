import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {LineChart, LineValue} from 'react-native-charts-wrapper';
import {processColor, useTheme} from 'react-native-paper';
import {BarPathPoint} from '../../models/entities/VideoAnalysis';

interface Props {
  barPathSeries1: BarPathPoint[];
  barPathSeries2: BarPathPoint[];
  trackingFrameWidth1?: number;
  trackingFrameHeight1?: number;
  trackingFrameWidth2?: number;
  trackingFrameHeight2?: number;
  height?: number;
}

const SMOOTHING_WINDOW = 5;

const smoothNumberSeries = (values: number[], windowSize: number): number[] => {
  if (values.length === 0 || windowSize <= 1) {
    return values;
  }
  const halfWindow = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length - 1, index + halfWindow);
    let sum = 0;
    let count = 0;
    for (let cursor = start; cursor <= end; cursor += 1) {
      sum += values[cursor];
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  });
};

const smoothBarPath = (series: BarPathPoint[]): BarPathPoint[] => {
  if (series.length < 3) {
    return series;
  }
  const sx = smoothNumberSeries(series.map((p) => p.x), SMOOTHING_WINDOW);
  const sy = smoothNumberSeries(series.map((p) => p.y), SMOOTHING_WINDOW);
  return series.map((p, i) => ({...p, x: sx[i], y: sy[i]}));
};

/**
 * Normalise bar-path x/y coordinates so both analyses are in comparable coordinate space.
 * If a tracking frame size is provided, normalise to [0, 1] using that.
 * Otherwise normalise relative to each series' own bounds.
 */
const normaliseToLineValues = (
  series: BarPathPoint[],
  frameW?: number,
  frameH?: number,
): LineValue[] => {
  if (series.length === 0) {
    return [];
  }
  if (frameW && frameH && frameW > 0 && frameH > 0) {
    return series.map((p) => ({x: p.x / frameW, y: 1 - p.y / frameH}));
  }
  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  // Flip Y so up = higher value (screen coords have y increasing downward)
  return series.map((p) => ({
    x: (p.x - minX) / spanX,
    y: 1 - (p.y - minY) / spanY,
  }));
};

const BarPathCompareView = ({
  barPathSeries1,
  barPathSeries2,
  trackingFrameWidth1,
  trackingFrameHeight1,
  trackingFrameWidth2,
  trackingFrameHeight2,
  height = 220,
}: Props) => {
  const theme = useTheme();

  const color1 = useMemo(() => processColor(theme.colors.primary), [theme]);
  const color2 = useMemo(() => processColor(theme.colors.error), [theme]);

  const smoothed1 = useMemo(() => smoothBarPath(barPathSeries1), [barPathSeries1]);
  const smoothed2 = useMemo(() => smoothBarPath(barPathSeries2), [barPathSeries2]);

  const lineValues1 = useMemo(
    () => normaliseToLineValues(smoothed1, trackingFrameWidth1, trackingFrameHeight1),
    [smoothed1, trackingFrameWidth1, trackingFrameHeight1],
  );
  const lineValues2 = useMemo(
    () => normaliseToLineValues(smoothed2, trackingFrameWidth2, trackingFrameHeight2),
    [smoothed2, trackingFrameWidth2, trackingFrameHeight2],
  );

  const chartData = useMemo(
    () => ({
      dataSets: [
        {
          values: lineValues1,
          label: 'Analysis A',
          config: {
            color: color1,
            drawCircles: false,
            drawValues: false,
            lineWidth: 2,
            mode: 'HORIZONTAL_BEZIER' as const,
            highlightEnabled: false,
          },
        },
        {
          values: lineValues2,
          label: 'Analysis B',
          config: {
            color: color2,
            drawCircles: false,
            drawValues: false,
            lineWidth: 2,
            mode: 'HORIZONTAL_BEZIER' as const,
            highlightEnabled: false,
          },
        },
      ],
    }),
    [lineValues1, lineValues2, color1, color2],
  );

  return (
    <View style={[styles.container, {height}]} testID="bar-path-compare-view">
      <LineChart
        style={styles.chart}
        data={chartData}
        legend={{enabled: true}}
        xAxis={{
          drawGridLines: true,
          gridColor: processColor(theme.colors.outlineVariant) as number,
          axisLineColor: processColor(theme.colors.outline) as number,
          textColor: processColor(theme.colors.onSurfaceVariant) as number,
          axisMinimum: 0,
          axisMaximum: 1,
          granularity: 0.1,
          granularityEnabled: true,
          drawLabels: false,
        }}
        yAxis={{
          left: {
            axisMinimum: 0,
            axisMaximum: 1,
            drawGridLines: true,
            gridColor: processColor(theme.colors.outlineVariant) as number,
            textColor: processColor(theme.colors.onSurfaceVariant) as number,
            drawLabels: false,
          },
          right: {enabled: false},
        }}
        animation={{durationX: 0, durationY: 0}}
        touchEnabled={true}
        dragEnabled={true}
        scaleEnabled={true}
        pinchZoom={true}
        doubleTapToZoomEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chart: {
    flex: 1,
  },
});

export default BarPathCompareView;
