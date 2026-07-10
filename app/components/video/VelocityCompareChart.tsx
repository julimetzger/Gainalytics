import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {GestureResponderEvent, LayoutChangeEvent, PixelRatio, StyleSheet, View} from 'react-native';
import {processColor} from 'react-native';
import Animated, {useAnimatedStyle, useDerivedValue, useSharedValue, SharedValue} from 'react-native-reanimated';
import {Text, useTheme} from 'react-native-paper';
import {LineChart} from 'react-native-charts-wrapper';
import {BarPathPoint} from '../../models/entities/VideoAnalysis';

interface Props {
  barPathSeries1: BarPathPoint[];
  barPathSeries2: BarPathPoint[];
  label1?: string;
  label2?: string;
  height?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * Shift applied to series 2 so it is plotted in shared-timeline space
   * (timeline x = videoBTime − timeOffset2Ms). 0 keeps raw video time.
   */
  timeOffset2Ms?: number;
  /** Timeline duration for the x-axis; falls back to the data extent. */
  timelineDurationMs?: number;
  /** Tap-to-seek on the plot; receives the tapped timeline position in ms. */
  onSeekTimeline?: (timelineMs: number) => void;
  /** Shared timeline position for the playback marker line. */
  progressSV?: SharedValue<number>;
}

const SMOOTHING_WINDOW = 5;
// Chart viewport paddings in dp — same convention as the Video Analysis Detail
// speed plot. viewPortOffsets expects physical pixels (× PixelRatio).
const CHART_LEFT_PADDING = 36;
const CHART_RIGHT_PADDING = 4;
const CHART_TOP_PADDING = 8;
const CHART_BOTTOM_PADDING = 22;

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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const VelocityCompareChart = ({
  barPathSeries1,
  barPathSeries2,
  height = 200,
  onLayout,
  timeOffset2Ms = 0,
  timelineDurationMs,
  onSeekTimeline,
  progressSV,
}: Props) => {
  const theme = useTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const chartWidthSV = useSharedValue(0);
  const axisMaxSV = useSharedValue(1);

  const color1 = useMemo(() => processColor(theme.colors.primary), [theme]);
  // Analysis B is rendered in tertiary (not error-red) so it reads as a
  // comparison series, in light and dark theme alike.
  const color2 = useMemo(() => processColor(theme.colors.tertiary), [theme]);
  const zeroColor = useMemo(() => processColor(theme.colors.outline), [theme]);

  const smoothed1 = useMemo(() => smoothBarPath(barPathSeries1), [barPathSeries1]);
  const smoothed2 = useMemo(() => smoothBarPath(barPathSeries2), [barPathSeries2]);

  const velocity1 = useMemo(() => calculateVelocitySeries(smoothed1), [smoothed1]);
  const velocity2 = useMemo(() => calculateVelocitySeries(smoothed2), [smoothed2]);

  // Series A is plotted in raw video-A time, which IS the shared timeline.
  const lineValues1 = useMemo(() => {
    const length = Math.min(smoothed1.length, velocity1.length);
    return smoothed1.slice(0, length).map((p, i) => ({x: p.tMs, y: velocity1[i]}));
  }, [smoothed1, velocity1]);

  // Series B is shifted into timeline space so rep 1 overlays rep 1.
  const lineValues2 = useMemo(() => {
    const length = Math.min(smoothed2.length, velocity2.length);
    return smoothed2.slice(0, length).map((p, i) => ({x: p.tMs - timeOffset2Ms, y: velocity2[i]}));
  }, [smoothed2, velocity2, timeOffset2Ms]);

  const allAbsVelocities = useMemo(() => {
    const all = [...velocity1, ...velocity2].map(Math.abs);
    return all.length > 0 ? all : [100];
  }, [velocity1, velocity2]);

  const axisMax = useMemo(() => Math.max(50, Math.ceil(Math.max(...allAbsVelocities) * 1.15)), [allAbsVelocities]);

  const dataMaxX = useMemo(() => {
    const x1 = lineValues1.length > 0 ? lineValues1[lineValues1.length - 1].x : 0;
    const x2 = lineValues2.length > 0 ? lineValues2[lineValues2.length - 1].x : 0;
    return Math.max(x1, x2, 1);
  }, [lineValues1, lineValues2]);

  const xAxisMax = timelineDurationMs && timelineDurationMs > 1 ? timelineDurationMs : dataMaxX;

  const zeroLine = useMemo(
    () => [{x: 0, y: 0}, {x: xAxisMax, y: 0}],
    [xAxisMax],
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

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setChartWidth(width);
      chartWidthSV.value = width; // eslint-disable-line react-hooks/exhaustive-deps
      onLayout?.(event);
    },
    [onLayout], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Keep the marker mapping in sync with the axis on the UI thread.
  useEffect(() => {
    axisMaxSV.value = xAxisMax; // eslint-disable-line react-hooks/exhaustive-deps
  }, [xAxisMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const markerLeft = useDerivedValue(() => {
    'worklet';
    if (!progressSV || chartWidthSV.value <= 0 || axisMaxSV.value <= 0) {
      return CHART_LEFT_PADDING;
    }
    const drawableWidth = Math.max(0, chartWidthSV.value - CHART_LEFT_PADDING - CHART_RIGHT_PADDING);
    const progress = Math.min(1, Math.max(0, progressSV.value / axisMaxSV.value));
    return CHART_LEFT_PADDING + progress * drawableWidth;
  });

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{translateX: markerLeft.value}],
  }));

  const onChartTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (!onSeekTimeline || chartWidth <= 0 || xAxisMax <= 0) {
        return;
      }
      const drawableWidth = Math.max(0, chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING);
      if (drawableWidth <= 0) {
        return;
      }
      const x = event.nativeEvent.locationX - CHART_LEFT_PADDING;
      const progress = clamp(x / drawableWidth, 0, 1);
      onSeekTimeline(Math.round(progress * xAxisMax));
    },
    [onSeekTimeline, chartWidth, xAxisMax],
  );

  return (
    <View testID="velocity-compare-chart" style={styles.container}>
      <View style={{height}} onLayout={handleLayout} onTouchEnd={onChartTouch}>
        <LineChart
          style={styles.chart}
          data={chartData}
          legend={{enabled: false}}
          chartDescription={{text: ''}}
          viewPortOffsets={{
          left: Math.round(CHART_LEFT_PADDING * PixelRatio.get()),
          top: Math.round(CHART_TOP_PADDING * PixelRatio.get()),
          right: Math.round(CHART_RIGHT_PADDING * PixelRatio.get()),
          bottom: Math.round(CHART_BOTTOM_PADDING * PixelRatio.get()),
          }}
          xAxis={{
          position: 'BOTTOM',
          drawGridLines: true,
          gridColor: processColor(theme.colors.outlineVariant) as number,
          axisLineColor: processColor(theme.colors.outline) as number,
          textColor: processColor(theme.colors.onSurfaceVariant) as number,
          // x values are timeline milliseconds; render as mm:ss like the
          // detail-screen speed plot.
          valueFormatter: 'date',
          valueFormatterPattern: 'mm:ss',
          granularity: 1000,
          granularityEnabled: true,
          axisMinimum: 0,
          axisMaximum: xAxisMax,
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
          // Chart touch is disabled so the wrapper receives taps for tap-to-seek.
          touchEnabled={false}
          dragEnabled={false}
          scaleEnabled={false}
          pinchZoom={false}
          doubleTapToZoomEnabled={false}
        />
        {progressSV && (
          <Animated.View
            testID="velocity-compare-marker"
            pointerEvents="none"
            style={[styles.markerLine, {backgroundColor: theme.colors.primary, height: height - CHART_BOTTOM_PADDING}, markerStyle]}
          />
        )}
      </View>
      <View style={styles.legendRow} pointerEvents="none">
        <View style={[styles.legendDot, {backgroundColor: theme.colors.primary}]} />
        <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>Analysis A</Text>
        <View style={[styles.legendDot, styles.legendDotSpacing, {backgroundColor: theme.colors.tertiary}]} />
        <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>Analysis B</Text>
      </View>
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
  markerLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2,
    opacity: 0.75,
  },
  legendRow: {
    marginTop: 6,
    marginLeft: CHART_LEFT_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendDotSpacing: {
    marginLeft: 10,
  },
});

export default VelocityCompareChart;
