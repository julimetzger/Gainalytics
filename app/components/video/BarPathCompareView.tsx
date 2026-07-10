import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import Svg, {Circle, Polyline} from 'react-native-svg';
import {IconButton, Text, useTheme} from 'react-native-paper';
import {BarPathPoint, RepSegment} from '../../models/entities/VideoAnalysis';
import {sliceBarPathForSegment, smoothBarPathSeries} from '../../utils/videoAnalysisSetAggregates';

interface Props {
  barPathSeries1: BarPathPoint[];
  barPathSeries2: BarPathPoint[];
  repSegments1: RepSegment[];
  repSegments2: RepSegment[];
  /** Rep at the shared scrubber position; the overlay follows it automatically. */
  currentRepIndex?: number;
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
 * Overlays the bar path of ONE rep of analysis A over the same rep of
 * analysis B — all reps at once are an unreadable tangle. The displayed rep
 * follows the shared scrubber automatically and can be switched manually via
 * the prev/next buttons. A line chart cannot draw these (x is not monotonic
 * over a rep), so the paths are rendered as SVG polylines; the dot marks each
 * path's starting point.
 */
const BarPathCompareView = ({
  barPathSeries1,
  barPathSeries2,
  repSegments1,
  repSegments2,
  currentRepIndex,
  height = 220,
}: Props) => {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const repCount = Math.max(repSegments1.length, repSegments2.length);
  const [displayedRepIndex, setDisplayedRepIndex] = useState(0);

  // Auto-follow: when the shared scrubber enters another rep, switch the
  // overlay with it (overriding any manual prev/next selection).
  useEffect(() => {
    if (currentRepIndex !== undefined && repCount > 0) {
      setDisplayedRepIndex(Math.max(0, Math.min(currentRepIndex, repCount - 1)));
    }
  }, [currentRepIndex, repCount]);

  const segment1 = useMemo(
    () => repSegments1.find((s) => s.repIndex === displayedRepIndex) ?? repSegments1[displayedRepIndex],
    [repSegments1, displayedRepIndex],
  );
  const segment2 = useMemo(
    () => repSegments2.find((s) => s.repIndex === displayedRepIndex) ?? repSegments2[displayedRepIndex],
    [repSegments2, displayedRepIndex],
  );

  // Fallback: without any detected reps there is nothing to slice — show the
  // whole path (and no rep switcher).
  const repSeries1 = useMemo(
    () => (repCount === 0 ? barPathSeries1 : sliceBarPathForSegment(barPathSeries1, segment1)),
    [barPathSeries1, segment1, repCount],
  );
  const repSeries2 = useMemo(
    () => (repCount === 0 ? barPathSeries2 : sliceBarPathForSegment(barPathSeries2, segment2)),
    [barPathSeries2, segment2, repCount],
  );

  const smoothed1 = useMemo(() => smoothBarPathSeries(repSeries1), [repSeries1]);
  const smoothed2 = useMemo(() => smoothBarPathSeries(repSeries2), [repSeries2]);
  const normalised1 = useMemo(() => normaliseToRomSpace(smoothed1), [smoothed1]);
  const normalised2 = useMemo(() => normaliseToRomSpace(smoothed2), [smoothed2]);

  const points1 = useMemo(() => toSvgPoints(normalised1, width, height), [normalised1, width, height]);
  const points2 = useMemo(() => toSvgPoints(normalised2, width, height), [normalised2, width, height]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const goPrev = useCallback(() => {
    setDisplayedRepIndex((index) => Math.max(0, index - 1));
  }, []);
  const goNext = useCallback(() => {
    setDisplayedRepIndex((index) => Math.min(repCount - 1, index + 1));
  }, [repCount]);

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
      {repCount > 0 && (
        <View style={styles.repSwitcherRow}>
          <IconButton
            testID="bar-path-rep-prev"
            icon="chevron-left"
            size={20}
            onPress={goPrev}
            disabled={displayedRepIndex <= 0}
          />
          <Text testID="bar-path-rep-label" variant="labelLarge">
            {`Rep ${displayedRepIndex + 1} / ${repCount}`}
          </Text>
          <IconButton
            testID="bar-path-rep-next"
            icon="chevron-right"
            size={20}
            onPress={goNext}
            disabled={displayedRepIndex >= repCount - 1}
          />
        </View>
      )}
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
  repSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
