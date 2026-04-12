import React, {useMemo} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {processColor, useTheme} from 'react-native-paper';
import {LineChart} from 'react-native-charts-wrapper';
import {BarPathPoint} from '../../models/entities/VideoAnalysis';

interface Props {
  barPathSeries1: BarPathPoint[];
  barPathSeries2: BarPathPoint[];
  label1?: string;
  label2?: string;
  height?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
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

const calculateVelocitySeries = (barPathSeries: BarPathPoint[]): number[] => {
  if (barPathSeries.length === 0) {
    return [];
  }
  const raw = barPathSeries.map((_, index) => {
    const previous = barPathSeries[Math.max(0, index - 1)];
    const next = barPathSeries[Math.min(barPathSeries.length - 1, index + 1)];
    const deltaTimeMs = Math.max(1, next.tMs - previous.tMs);
    return (previous.y - next.y) / (deltaTimeMs / 1000);
  });
  return smoothNumberSeries(raw, SMOOTHING_WINDOW);
};

const smoothBarPath = (series: BarPathPoint[]): BarPathPoint[] => {
  if (series.length < 3) {
    return series;
  }
  const sx = smoothNumberSeries(series.map((p) => p.x), SMOOTHING_WINDOW);
  const sy = smoothNumberSeries(series.map((p) => p.y), SMOOTHING_WINDOW);
  return series.map((p, i) => ({...p, x: sx[i], y: sy[i]}));
};

const VelocityCompareChart = ({barPathSeries1, barPathSeries2, height = 200, onLayout}: Props) => {
  const theme = useTheme();

  const color1 = useMemo(() => processColor(theme.colors.primary), [theme]);
  const color2 = useMemo(() => processColor(theme.colors.error), [theme]);
  const zeroColor = useMemo(() => processColor(theme.colors.outline), [theme]);

  const smoothed1 = useMemo(() => smoothBarPath(barPathSeries1), [barPathSeries1]);
  const smoothed2 = useMemo(() => smoothBarPath(barPathSeries2), [barPathSeries2]);

  const velocity1 = useMemo(() => calculateVelocitySeries(smoothed1), [smoothed1]);
  const velocity2 = useMemo(() => calculateVelocitySeries(smoothed2), [smoothed2]);

  // Normalize time axis: shift both series so that t=0 is the start of each analysis
  const lineValues1 = useMemo(() => {
    const offset = smoothed1.length > 0 ? smoothed1[0].tMs : 0;
    const length = Math.min(smoothed1.length, velocity1.length);
    return smoothed1.slice(0, length).map((p, i) => ({x: p.tMs - offset, y: velocity1[i]}));
  }, [smoothed1, velocity1]);

  const lineValues2 = useMemo(() => {
    const offset = smoothed2.length > 0 ? smoothed2[0].tMs : 0;
    const length = Math.min(smoothed2.length, velocity2.length);
    return smoothed2.slice(0, length).map((p, i) => ({x: p.tMs - offset, y: velocity2[i]}));
  }, [smoothed2, velocity2]);

  const allAbsVelocities = useMemo(() => {
    const all = [...velocity1, ...velocity2].map(Math.abs);
    return all.length > 0 ? all : [100];
  }, [velocity1, velocity2]);

  const axisMax = useMemo(() => Math.max(50, Math.ceil(Math.max(...allAbsVelocities) * 1.15)), [allAbsVelocities]);

  const maxX = useMemo(() => {
    const x1 = lineValues1.length > 0 ? lineValues1[lineValues1.length - 1].x : 0;
    const x2 = lineValues2.length > 0 ? lineValues2[lineValues2.length - 1].x : 0;
    return Math.max(x1, x2, 1);
  }, [lineValues1, lineValues2]);

  const zeroLine = useMemo(
    () => (maxX > 0 ? [{x: 0, y: 0}, {x: maxX, y: 0}] : []),
    [maxX],
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
        {
          values: zeroLine,
          label: '',
          config: {
            color: zeroColor,
            drawCircles: false,
            drawValues: false,
            lineWidth: 1,
            mode: 'LINEAR' as const,
            highlightEnabled: false,
          },
        },
      ],
    }),
    [lineValues1, lineValues2, zeroLine, color1, color2, zeroColor],
  );

  return (
    <View style={[styles.container, {height}]} onLayout={onLayout}>
      <LineChart
        style={styles.chart}
        data={chartData}
        legend={{enabled: true}}
        xAxis={{
          drawGridLines: true,
          gridColor: processColor(theme.colors.outlineVariant) as number,
          axisLineColor: processColor(theme.colors.outline) as number,
          textColor: processColor(theme.colors.onSurfaceVariant) as number,
          granularity: 1,
          granularityEnabled: true,
        }}
        yAxis={{
          left: {
            axisMaximum: axisMax,
            axisMinimum: -axisMax,
            drawGridLines: true,
            gridColor: processColor(theme.colors.outlineVariant) as number,
            textColor: processColor(theme.colors.onSurfaceVariant) as number,
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

export default VelocityCompareChart;
