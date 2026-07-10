import React, {useCallback, useMemo, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import Svg, {Circle, Polyline} from 'react-native-svg';
import {Text, useTheme} from 'react-native-paper';
import {BarPathPoint} from '../../models/entities/VideoAnalysis';
import {smoothBarPathSeries} from '../../utils/videoAnalysisSetAggregates';

interface Props {
  barPathSeries1: BarPathPoint[];
  barPathSeries2: BarPathPoint[];
  trackingFrameWidth1?: number;
  trackingFrameHeight1?: number;
  trackingFrameWidth2?: number;
  trackingFrameHeight2?: number;
  height?: number;
}

const PADDING = 12;

/**
 * Normalise a bar path into ROM space: y ∈ [0, 1] over the bar's own vertical
 * range, x centred on the path's horizontal midpoint and scaled by the SAME
 * factor as y so horizontal drift keeps its true proportion to the range of
 * motion. Both analyses end up overlaid and vertically aligned regardless of
 * camera distance or framing.
 */
const normaliseToRomSpace = (series: BarPathPoint[]): {x: number; y: number}[] => {
  if (series.length === 0) {
    return [];
  }
  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const minY = Math.min(...ys);
  const spanY = Math.max(1, Math.max(...ys) - minY);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  // Tracking-frame y grows downward, matching SVG coordinates: no flip needed.
  return series.map((p) => ({
    x: (p.x - centerX) / spanY,
    y: (p.y - minY) / spanY,
  }));
};

const toSvgPoints = (normalised: {x: number; y: number}[], width: number, height: number): string => {
  const scale = Math.max(1, height - 2 * PADDING);
  return normalised
    .map((p) => `${(width / 2 + p.x * scale).toFixed(1)},${(PADDING + p.y * scale).toFixed(1)}`)
    .join(' ');
};

/**
 * Overlays the bar paths of both analyses as true 2D trajectories. A line
 * chart cannot draw these (x is not monotonic over a rep), so the paths are
 * rendered as SVG polylines; the dot marks each path's starting point.
 */
const BarPathCompareView = ({barPathSeries1, barPathSeries2, height = 220}: Props) => {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const smoothed1 = useMemo(() => smoothBarPathSeries(barPathSeries1), [barPathSeries1]);
  const smoothed2 = useMemo(() => smoothBarPathSeries(barPathSeries2), [barPathSeries2]);
  const normalised1 = useMemo(() => normaliseToRomSpace(smoothed1), [smoothed1]);
  const normalised2 = useMemo(() => normaliseToRomSpace(smoothed2), [smoothed2]);

  const points1 = useMemo(() => toSvgPoints(normalised1, width, height), [normalised1, width, height]);
  const points2 = useMemo(() => toSvgPoints(normalised2, width, height), [normalised2, width, height]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const startDot = (points: string, color: string, testID: string) => {
    const first = points.split(' ')[0];
    if (!first) {
      return null;
    }
    const [cx, cy] = first.split(',');
    return <Circle testID={testID} cx={cx} cy={cy} r={4} fill={color} />;
  };

  return (
    <View style={styles.container} testID="bar-path-compare-view">
      <View style={{height}} onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {points1.length > 0 && (
              <Polyline
                testID="bar-path-compare-path-a"
                points={points1}
                stroke={theme.colors.primary}
                // A is drawn wider underneath B so it stays visible as an
                // outline when both paths (nearly) coincide.
                strokeWidth={5}
                strokeOpacity={0.9}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {points2.length > 0 && (
              <Polyline
                testID="bar-path-compare-path-b"
                points={points2}
                stroke={theme.colors.tertiary}
                strokeWidth={2.5}
                strokeOpacity={0.9}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {startDot(points1, theme.colors.primary, 'bar-path-compare-start-a')}
            {startDot(points2, theme.colors.tertiary, 'bar-path-compare-start-b')}
          </Svg>
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
  legendRow: {
    marginTop: 6,
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

export default BarPathCompareView;
