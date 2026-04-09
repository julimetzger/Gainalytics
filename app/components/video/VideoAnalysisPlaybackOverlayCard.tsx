import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {GestureResponderEvent, LayoutChangeEvent, PixelRatio, StyleSheet, TouchableOpacity, View, processColor} from 'react-native';
import Animated, {Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming} from 'react-native-reanimated';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import {IconButton, MD3Theme, Text, useTheme} from 'react-native-paper';
import {LineChart, LineValue} from 'react-native-charts-wrapper';
import {BarPathPoint, BarTrackingResult, RepSegment, VideoAnalysisRepResult, VideoAnalysisSetResult} from '../../models/entities/VideoAnalysis';
import {dispatchSaveVideoAnalysisSetResult} from '../../redux/VideoAnalysis/dispatch/dispatchSaveVideoAnalysisSetResult';
import VideoAnalysisPlayerView, {VideoPlayerLoadEvent, VideoPlayerProgressEvent} from './VideoAnalysisPlayerView';

interface Props {
  analysisId: number;
  localVideoPath: string;
  result: BarTrackingResult;
  savedSetResult?: VideoAnalysisSetResult;
}

interface TimeRange {
  minTimeMs: number;
  maxTimeMs: number;
  durationMs: number;
}

const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;
const SPEED_PLOT_HEIGHT = 240;
// Left offset of the chart drawable area (dp). Used for JS layout (translateX, touch mapping).
// viewPortOffsets.left must be SPEED_CHART_LEFT_PADDING * PixelRatio.get() because
// MPAndroidChart's setViewPortOffsets() expects physical pixels, not dp.
const SPEED_CHART_LEFT_PADDING = 36;
// Right viewport offset in dp — must stay in sync with viewPortOffsets.right.
const SPEED_CHART_RIGHT_PADDING = 4;
const BAR_PATH_SMOOTHING_WINDOW = 5;
const SPEED_SMOOTHING_WINDOW = 5;

const formatDuration = (timeMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

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

const smoothBarPathSeries = (barPathSeries: BarPathPoint[]): BarPathPoint[] => {
  if (barPathSeries.length < 3) {
    return barPathSeries;
  }

  const smoothedX = smoothNumberSeries(
    barPathSeries.map((point) => point.x),
    BAR_PATH_SMOOTHING_WINDOW,
  );
  const smoothedY = smoothNumberSeries(
    barPathSeries.map((point) => point.y),
    BAR_PATH_SMOOTHING_WINDOW,
  );

  return barPathSeries.map((point, index) => ({
    ...point,
    x: smoothedX[index],
    y: smoothedY[index],
  }));
};

const calculateBarVerticalVelocitySeries = (barPathSeries: BarPathPoint[]): number[] => {
  if (barPathSeries.length === 0) {
    return [];
  }

  const rawVerticalVelocities = barPathSeries.map((_, index) => {
    const previous = barPathSeries[Math.max(0, index - 1)];
    const next = barPathSeries[Math.min(barPathSeries.length - 1, index + 1)];
    const deltaTimeMs = Math.max(1, next.tMs - previous.tMs);
    const deltaTimeSeconds = deltaTimeMs / 1000;
    // Screen-space y increases downward; expose physics-friendly sign:
    // downward movement => negative v_y, upward movement => positive v_y.
    return (previous.y - next.y) / deltaTimeSeconds;
  });

  return smoothNumberSeries(rawVerticalVelocities, SPEED_SMOOTHING_WINDOW);
};

/**
 * Resample an (x, y) series at evenly-spaced Y values within [yMin, yMax].
 * Assumes the series is monotone in Y (either ascending or descending).
 * Returns an array of interpolated X values of length `sampleCount`.
 */
const resampleXAtYPoints = (series: BarPathPoint[], yMin: number, yMax: number, sampleCount: number): number[] => {
  if (series.length < 2 || sampleCount < 1 || yMax <= yMin) {
    return Array(sampleCount).fill(0);
  }
  const result: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const targetY = yMin + (i / Math.max(1, sampleCount - 1)) * (yMax - yMin);
    // Find the two nearest points that bracket targetY
    let lo = 0;
    let hi = series.length - 1;
    for (let j = 0; j < series.length - 1; j++) {
      const yA = series[j].y;
      const yB = series[j + 1].y;
      if ((yA <= targetY && targetY <= yB) || (yB <= targetY && targetY <= yA)) {
        lo = j;
        hi = j + 1;
        break;
      }
    }
    const yLo = series[lo].y;
    const yHi = series[hi].y;
    const span = yHi - yLo;
    const t = Math.abs(span) < 0.001 ? 0 : (targetY - yLo) / span;
    result.push(series[lo].x + t * (series[hi].x - series[lo].x));
  }
  return result;
};

const DEVIATION_RESAMPLE_COUNT = 20;

/**
 * Calculate the bar-path deviation between eccentric and concentric phases for one rep.
 * The eccentric path (bar going down) serves as the reference line.
 * Returns delta_x (concentric_x − eccentric_x at each resampled Y point)
 * and path_deviation (mean |delta_x| / trackingFrameWidthPx).
 */
export const calculateBarPathDeviation = (
  barPathSeries: BarPathPoint[],
  startMs: number,
  turnaroundMs: number,
  endMs: number,
  trackingFrameWidthPx: number,
): {delta_x: number[]; path_deviation: number | undefined} => {
  const noData = {delta_x: [], path_deviation: undefined};
  if (barPathSeries.length < 4 || turnaroundMs <= startMs || endMs <= turnaroundMs || trackingFrameWidthPx <= 0) {
    return noData;
  }

  const eccPhase = barPathSeries.filter((p) => p.tMs >= startMs && p.tMs <= turnaroundMs);
  const conPhase = barPathSeries.filter((p) => p.tMs >= turnaroundMs && p.tMs <= endMs);

  if (eccPhase.length < 2 || conPhase.length < 2) {
    return noData;
  }

  const eccYMin = Math.min(...eccPhase.map((p) => p.y));
  const eccYMax = Math.max(...eccPhase.map((p) => p.y));
  const conYMin = Math.min(...conPhase.map((p) => p.y));
  const conYMax = Math.max(...conPhase.map((p) => p.y));

  // Overlapping Y range (screen-space: larger Y = lower physical position)
  const overlapYMin = Math.max(eccYMin, conYMin);
  const overlapYMax = Math.min(eccYMax, conYMax);

  if (overlapYMax <= overlapYMin) {
    return noData;
  }

  const eccX = resampleXAtYPoints(eccPhase, overlapYMin, overlapYMax, DEVIATION_RESAMPLE_COUNT);
  const conX = resampleXAtYPoints(conPhase, overlapYMin, overlapYMax, DEVIATION_RESAMPLE_COUNT);

  const delta_x = eccX.map((ex, i) => conX[i] - ex);
  const meanAbsDelta = delta_x.reduce((sum, d) => sum + Math.abs(d), 0) / delta_x.length;
  const path_deviation = meanAbsDelta / trackingFrameWidthPx;

  return {delta_x, path_deviation};
};

const getTimeRange = (barPathSeries: BarPathPoint[]): TimeRange => {
  if (barPathSeries.length === 0) {
    return {minTimeMs: 0, maxTimeMs: 0, durationMs: 0};
  }
  const minTimeMs = barPathSeries[0].tMs;
  const maxTimeMs = barPathSeries[barPathSeries.length - 1].tMs;
  return {
    minTimeMs,
    maxTimeMs,
    durationMs: Math.max(0, maxTimeMs - minTimeMs),
  };
};

const findRepIndexForTimeMs = (segments: RepSegment[], timeMs: number): number | undefined => {
  if (segments.length === 0) {
    return undefined;
  }

  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const segment = segments[middle];
    if (timeMs < segment.startMs) {
      high = middle - 1;
      continue;
    }
    if (timeMs > segment.endMs) {
      low = middle + 1;
      continue;
    }
    return segment.repIndex;
  }
  return undefined;
};

const mapVerticalVelocitySeriesToLineValues = (barPathSeries: BarPathPoint[], verticalVelocitySeries: number[]): LineValue[] => {
  if (barPathSeries.length === 0 || verticalVelocitySeries.length === 0) {
    return [];
  }

  const length = Math.min(barPathSeries.length, verticalVelocitySeries.length);
  return barPathSeries.slice(0, length).map((point, index) => ({
    x: point.tMs,
    y: verticalVelocitySeries[index],
  }));
};

const buildHorizontalReferenceLine = (barPathSeries: BarPathPoint[], yValue: number): LineValue[] => {
  if (barPathSeries.length === 0) {
    return [];
  }

  const startX = barPathSeries[0].tMs;
  const endX = barPathSeries[barPathSeries.length - 1].tMs;
  const safeEndX = endX > startX ? endX : startX + 1;
  return [
    {x: startX, y: yValue},
    {x: safeEndX, y: yValue},
  ];
};


const findNearestBarPathPointIndex = (barPathSeries: BarPathPoint[], timeMs: number): number | undefined => {
  if (barPathSeries.length === 0) {
    return undefined;
  }

  let nearestIndex = 0;
  let nearestDistance = Math.abs(timeMs - barPathSeries[0].tMs);

  for (let index = 1; index < barPathSeries.length; index += 1) {
    const distance = Math.abs(timeMs - barPathSeries[index].tMs);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }

  return nearestIndex;
};

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    previewBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    scrubberTrack: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    scrubberFill: {
      backgroundColor: theme.colors.outline,
    },
    scrubberThumb: {
      backgroundColor: theme.colors.primary,
    },
    speedPlotBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    repMetricAccent: {
      borderLeftColor: theme.colors.primary,
    },
    videoControlsBackground: {
      backgroundColor: theme.colors.backdrop,
    },
    statsText: {
      color: theme.colors.onSurfaceVariant,
    },
  });

const VideoAnalysisPlaybackOverlayCard = ({analysisId, localVideoPath, result, savedSetResult}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const saveSetResult = dispatchSaveVideoAnalysisSetResult();
  const speedChartColors = useMemo(
    () => ({
      line: processColor(theme.colors.secondary),
      zeroLine: processColor(theme.colors.outline),
      progressLine: processColor(theme.colors.primary),
      text: processColor(theme.colors.onSurfaceVariant),
      grid: processColor(theme.colors.outlineVariant),
      axis: processColor(theme.colors.outline),
    }),
    [theme],
  );
  const nativeOverlayColors = useMemo(
    () => ({
      primary: (processColor(theme.colors.primary) ?? undefined) as number | undefined,
      path: (processColor(theme.colors.outline) ?? undefined) as number | undefined,
    }),
    [theme],
  );
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [playbackVideoWidth, setPlaybackVideoWidth] = useState(0);
  const [playbackVideoHeight, setPlaybackVideoHeight] = useState(0);
  const [currentRepIndex, setCurrentRepIndex] = useState<number | undefined>();
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [seekPositionMs, setSeekPositionMs] = useState<number | undefined>(undefined);
  const [speedChartWidth, setSpeedChartWidth] = useState(0);
  const [showCalibration, setShowCalibration] = useState(false);
  const [firstRepTurnaroundOverrideMs, setFirstRepTurnaroundOverrideMs] = useState<number | null>(null);
  const [firstRepEndOverrideMs, setFirstRepEndOverrideMs] = useState<number | null>(null);
  const [lastRepTurnaroundOverrideMs, setLastRepTurnaroundOverrideMs] = useState<number | null>(null);
  const [lastRepEndOverrideMs, setLastRepEndOverrideMs] = useState<number | null>(null);
  // useRef wrapper ensures the SharedValue object is stable across renders.
  // The Reanimated mock creates a new plain object on each useSharedValue call,
  // so without useRef the animated styles would always see value=0 in tests.
  const playbackTimeMsSV = useRef(useSharedValue(0)).current;
  // Tracks actual video duration as a SharedValue for UI-thread marker/scrubber animations.
  const videoDurationMsSV = useRef(useSharedValue(0)).current;
  const speedChartWidthSV = useRef(useSharedValue(0)).current;
  // Visible x-range as reported by the native chart on zoom/pan.
  const chartVisibleMinSV = useRef(useSharedValue(0)).current;
  const chartVisibleMaxSV = useRef(useSharedValue(0)).current;

  const playbackDurationRef = useRef(0);
  const playbackTimeRef = useRef(0);
  const playbackPausedRef = useRef(true);
  const currentRepIndexRef = useRef<number | undefined>(undefined);
  const isScrubbingRef = useRef(false);
  const seekCooldownUntilRef = useRef(0);
  const chartVisibleMinRef = useRef(-1);
  const chartVisibleMaxRef = useRef(-1);
  const [chartVisibleForLines, setChartVisibleForLines] = useState<{min: number; max: number} | null>(null);
  const chartGestureActiveUntilRef = useRef(0);

  // Video pinch-to-zoom state (UI thread only, no re-renders).
  const videoScale = useRef(useSharedValue(1)).current;
  const videoTranslateX = useRef(useSharedValue(0)).current;
  const videoTranslateY = useRef(useSharedValue(0)).current;
  const videoScaleBase = useRef(useSharedValue(1)).current;
  const videoTranslateXBase = useRef(useSharedValue(0)).current;
  const videoTranslateYBase = useRef(useSharedValue(0)).current;

  const repSegments = result.repSegments;
  const firstRepSegment = repSegments.length > 0 ? repSegments[0] : null;
  const firstRepTurnaroundMs = firstRepTurnaroundOverrideMs ?? firstRepSegment?.turnaroundMs ?? 0;
  const firstRepEndMs = firstRepEndOverrideMs ?? firstRepSegment?.endMs ?? 0;
  const firstRepConcentricTimeMs = firstRepSegment ? Math.max(0, firstRepEndMs - firstRepTurnaroundMs) : 0;
  const lastRepSegment = repSegments.length > 1 ? repSegments[repSegments.length - 1] : null;
  const lastRepTurnaroundMs = lastRepTurnaroundOverrideMs ?? lastRepSegment?.turnaroundMs ?? 0;
  const lastRepEndMs = lastRepEndOverrideMs ?? lastRepSegment?.endMs ?? 0;
  const lastRepConcentricTimeMs = lastRepSegment ? Math.max(0, lastRepEndMs - lastRepTurnaroundMs) : 0;
  const smoothedBarPathSeries = useMemo(() => smoothBarPathSeries(result.barPathSeries), [result.barPathSeries]);
  const smoothedBarVerticalVelocitySeries = useMemo(() => calculateBarVerticalVelocitySeries(smoothedBarPathSeries), [smoothedBarPathSeries]);

  const calcIntervalMetrics = useCallback((startMs: number, endMs: number) => {
    if (startMs >= endMs || smoothedBarPathSeries.length === 0) {
      return null;
    }
    const velocities: number[] = [];
    for (let i = 0; i < smoothedBarPathSeries.length; i++) {
      const t = smoothedBarPathSeries[i].tMs;
      if (t >= startMs && t <= endMs && i < smoothedBarVerticalVelocitySeries.length) {
        velocities.push(smoothedBarVerticalVelocitySeries[i]);
      }
    }
    if (velocities.length === 0) {
      return null;
    }
    const absVelocities = velocities.map(Math.abs);
    return {
      timeMs: endMs - startMs,
      vPeak: Math.round(Math.max(...absVelocities)),
      vMin: Math.round(Math.min(...absVelocities)),
      vAvg: Math.round(absVelocities.reduce((sum, v) => sum + v, 0) / absVelocities.length),
    };
  }, [smoothedBarPathSeries, smoothedBarVerticalVelocitySeries]);

  const firstRepIntervalMetrics = useMemo(
    () => firstRepSegment ? calcIntervalMetrics(firstRepTurnaroundMs, firstRepEndMs) : null,
    [firstRepSegment, firstRepTurnaroundMs, firstRepEndMs, calcIntervalMetrics],
  );
  const lastRepIntervalMetrics = useMemo(
    () => lastRepSegment ? calcIntervalMetrics(lastRepTurnaroundMs, lastRepEndMs) : null,
    [lastRepSegment, lastRepTurnaroundMs, lastRepEndMs, calcIntervalMetrics],
  );
  // Velocity Loss: VL = 1 - (v_last / v_ref), where v_ref is the best avg
  // velocity from the first rep (proxy for max of first 3 reps).
  const velocityLoss = useMemo(() => {
    if (!firstRepIntervalMetrics || !lastRepIntervalMetrics || firstRepIntervalMetrics.vAvg <= 0) {
      return null;
    }
    const vl = 1 - (lastRepIntervalMetrics.vAvg / firstRepIntervalMetrics.vAvg);
    return Math.round(vl * 100);
  }, [firstRepIntervalMetrics, lastRepIntervalMetrics]);

  // RIR estimate based on velocity loss (heuristic v1 from issue #66)
  const rirEstimate = useMemo(() => {
    if (velocityLoss === null) {
      return null;
    }
    if (velocityLoss < 10) { return '4+'; }
    if (velocityLoss < 20) { return '3-4'; }
    if (velocityLoss < 30) { return '2-3'; }
    if (velocityLoss < 40) { return '1-2'; }
    return '0-1';
  }, [velocityLoss]);

  const timeRange = useMemo(() => getTimeRange(smoothedBarPathSeries), [smoothedBarPathSeries]);
  const correctedPlaybackDurationMs = useMemo(() => {
    return Math.max(playbackDurationMs, timeRange.maxTimeMs);
  }, [playbackDurationMs, timeRange.maxTimeMs]);

  // Keep videoDurationMsSV in sync with correctedPlaybackDurationMs for UI-thread animations.
  // SharedValue intentionally excluded from deps (stable ref, memory entry #16).
  useEffect(() => {
    if (correctedPlaybackDurationMs > 0) {
      videoDurationMsSV.value = correctedPlaybackDurationMs; // eslint-disable-line react-hooks/exhaustive-deps
      // Initialize visible range to full duration so the marker is correctly
      // positioned before any zoom event arrives from the chart.
      chartVisibleMinSV.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
      chartVisibleMaxSV.value = correctedPlaybackDurationMs; // eslint-disable-line react-hooks/exhaustive-deps
      chartVisibleMinRef.current = 0;
      chartVisibleMaxRef.current = correctedPlaybackDurationMs;
    }
  }, [correctedPlaybackDurationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressMarkerLeft = useDerivedValue(() => {
    'worklet';
    if (speedChartWidthSV.value <= 0) {
      return 0;
    }
    const drawableWidth = Math.max(0, speedChartWidthSV.value - SPEED_CHART_LEFT_PADDING - SPEED_CHART_RIGHT_PADDING);
    const rangeMin = chartVisibleMinSV.value;
    const rangeMax = chartVisibleMaxSV.value;
    const rangeSpan = rangeMax - rangeMin;
    if (rangeSpan <= 0) {
      return SPEED_CHART_LEFT_PADDING;
    }
    const progress = Math.min(1, Math.max(0, (playbackTimeMsSV.value - rangeMin) / rangeSpan));
    return SPEED_CHART_LEFT_PADDING + progress * drawableWidth;
  });

  // Scrubber fill and thumb are driven by Reanimated SharedValues on the UI thread — no JS state.
  const scrubberFillStyle = useAnimatedStyle(() => {
    'worklet';
    if (videoDurationMsSV.value <= 0) {
      return {width: '0%'};
    }
    const pct = Math.min(1, Math.max(0, playbackTimeMsSV.value / videoDurationMsSV.value)) * 100;
    return {width: `${pct}%` as any};
  });

  const scrubberThumbStyle = useAnimatedStyle(() => {
    'worklet';
    if (videoDurationMsSV.value <= 0) {
      return {left: '0%'};
    }
    const pct = Math.min(1, Math.max(0, playbackTimeMsSV.value / videoDurationMsSV.value)) * 100;
    return {left: `${pct}%` as any};
  });

  const playbackAspectRatio = useMemo(() => {
    const trackingWidth = result.analysisMeta.trackingFrameWidthPx;
    const trackingHeight = result.analysisMeta.trackingFrameHeightPx;
    if (trackingWidth && trackingHeight && trackingWidth > 0 && trackingHeight > 0) {
      return trackingWidth / trackingHeight;
    }
    if (playbackVideoWidth > 0 && playbackVideoHeight > 0) {
      return playbackVideoWidth / playbackVideoHeight;
    }
    return DEFAULT_PREVIEW_ASPECT_RATIO;
  }, [playbackVideoHeight, playbackVideoWidth, result.analysisMeta.trackingFrameHeightPx, result.analysisMeta.trackingFrameWidthPx]);
  const verticalVelocityLineValues = useMemo(() => mapVerticalVelocitySeriesToLineValues(smoothedBarPathSeries, smoothedBarVerticalVelocitySeries), [
    smoothedBarPathSeries,
    smoothedBarVerticalVelocitySeries,
  ]);
  const currentBarPathPointIndex = useMemo(
    () => findNearestBarPathPointIndex(smoothedBarPathSeries, playbackTimeMs),
    [playbackTimeMs, smoothedBarPathSeries],
  );
  const currentBarVerticalVelocityPxPerSecond = useMemo(() => {
    if (currentBarPathPointIndex === undefined || currentBarPathPointIndex >= smoothedBarVerticalVelocitySeries.length) {
      return undefined;
    }
    return smoothedBarVerticalVelocitySeries[currentBarPathPointIndex];
  }, [currentBarPathPointIndex, smoothedBarVerticalVelocitySeries]);
  const verticalVelocityAxisLimit = useMemo(() => {
    if (smoothedBarVerticalVelocitySeries.length === 0) {
      return 100;
    }
    const maxAbsoluteVelocity = Math.max(...smoothedBarVerticalVelocitySeries.map((value) => Math.abs(value)));
    return Math.max(50, Math.ceil(maxAbsoluteVelocity * 1.15));
  }, [smoothedBarVerticalVelocitySeries]);
  const zeroVelocityLineValues = useMemo(() => buildHorizontalReferenceLine(smoothedBarPathSeries, 0), [smoothedBarPathSeries]);
  const speedChartData = useMemo(
    () => ({
      dataSets: [
        {
          values: verticalVelocityLineValues,
          config: {
            color: speedChartColors.line,
            drawCircles: false,
            drawValues: false,
            lineWidth: 2,
            mode: 'HORIZONTAL_BEZIER',
            highlightEnabled: false,
          },
        },
        {
          values: zeroVelocityLineValues,
          config: {
            color: speedChartColors.zeroLine,
            drawCircles: false,
            drawValues: false,
            lineWidth: 1,
            mode: 'LINEAR',
            highlightEnabled: false,
          },
        },
      ],
    }),
    [verticalVelocityLineValues, zeroVelocityLineValues, speedChartColors.line, speedChartColors.zeroLine],
  );
  const updateCurrentRepForPlaybackTime = useCallback(
    (nextPlaybackTimeMs: number) => {
      if (repSegments.length === 0) {
        if (currentRepIndexRef.current !== undefined) {
          currentRepIndexRef.current = undefined;
          setCurrentRepIndex(undefined);
        }
        return;
      }

      const analysisTimeMs = clamp(nextPlaybackTimeMs, timeRange.minTimeMs, timeRange.maxTimeMs);
      const nextRepIndex = findRepIndexForTimeMs(repSegments, analysisTimeMs);
      if (nextRepIndex !== currentRepIndexRef.current) {
        currentRepIndexRef.current = nextRepIndex;
        setCurrentRepIndex(nextRepIndex);
      }
    },
    [repSegments, timeRange.maxTimeMs, timeRange.minTimeMs],
  );

  const onPlayerLoad = useCallback((event: {nativeEvent?: VideoPlayerLoadEvent}) => {
    if (!event.nativeEvent) {
      return;
    }
    const {durationMs, videoWidth, videoHeight} = event.nativeEvent;
    const nextDuration = Math.max(playbackDurationRef.current, durationMs);
    if (nextDuration !== playbackDurationRef.current) {
      playbackDurationRef.current = nextDuration;
      setPlaybackDurationMs(nextDuration);
    }
    if (videoWidth > 0 && videoHeight > 0) {
      setPlaybackVideoWidth(videoWidth);
      setPlaybackVideoHeight(videoHeight);
    }
  }, []);

  // onPlayerProgress updates duration and corrects the marker animation when
  // it drifts too far from the real player position. The withTiming animation
  // provides smooth 60fps movement, but ExoPlayer can lag behind due to
  // decoding/buffering, causing the marker to run ahead. A periodic correction
  // re-syncs the animation without visible jank.
  const onPlayerProgress = useCallback(
    (event: {nativeEvent?: VideoPlayerProgressEvent}) => {
      const nativeEvent = event.nativeEvent;
      if (!nativeEvent) {
        return;
      }
      if (nativeEvent.durationMs > 0) {
        const nextDuration = Math.max(playbackDurationRef.current, nativeEvent.durationMs);
        if (nextDuration !== playbackDurationRef.current) {
          playbackDurationRef.current = nextDuration;
          setPlaybackDurationMs(nextDuration);
        }
      }
      updateCurrentRepForPlaybackTime(nativeEvent.currentTimeMs);

      // Correct marker drift: if the animated value is more than 80ms ahead of
      // the real player position, restart the animation from the actual position.
      // Skip correction during seek cooldown so the player can catch up.
      if (!playbackPausedRef.current && !isScrubbingRef.current && Date.now() > seekCooldownUntilRef.current) {
        const animatedMs = playbackTimeMsSV.value;
        const drift = animatedMs - nativeEvent.currentTimeMs;
        if (drift > 80) {
          const totalDuration = playbackDurationRef.current;
          if (totalDuration > 0) {
            cancelAnimation(playbackTimeMsSV);
            playbackTimeMsSV.value = nativeEvent.currentTimeMs;
            const remainingMs = Math.max(0, totalDuration - nativeEvent.currentTimeMs);
            if (remainingMs > 0) {
              playbackTimeMsSV.value = withTiming(totalDuration, {
                duration: remainingMs,
                easing: Easing.linear,
              });
            }
          }
        }
      }
    },
    [updateCurrentRepForPlaybackTime],
  );

  const onPlayerEnd = useCallback(() => {
    cancelAnimation(playbackTimeMsSV); // eslint-disable-line react-hooks/exhaustive-deps
    const duration = playbackDurationRef.current;
    playbackTimeMsSV.value = duration; // eslint-disable-line react-hooks/exhaustive-deps
    playbackTimeRef.current = duration;
    setPlaybackTimeMs(duration);
    setPlaybackPaused(true);
    playbackPausedRef.current = true;
    updateCurrentRepForPlaybackTime(duration);
  }, [updateCurrentRepForPlaybackTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // applySeekTimeMs: cancel any running animation, jump to new position immediately,
  // and restart the animation if currently playing.
  const applySeekTimeMs = useCallback(
    (nextTimeMs: number) => {
      const clampedTimeMs = clamp(Math.round(nextTimeMs), 0, correctedPlaybackDurationMs);
      cancelAnimation(playbackTimeMsSV); // eslint-disable-line react-hooks/exhaustive-deps
      playbackTimeMsSV.value = clampedTimeMs; // eslint-disable-line react-hooks/exhaustive-deps
      playbackTimeRef.current = clampedTimeMs;
      setPlaybackTimeMs(clampedTimeMs);
      setSeekPositionMs(clampedTimeMs);
      updateCurrentRepForPlaybackTime(clampedTimeMs);
      // Suppress drift correction for 300ms so the player can catch up to the
      // new seek position without onPlayerProgress snapping the marker back.
      seekCooldownUntilRef.current = Date.now() + 300;

      // Restart animation from new position if currently playing.
      if (!playbackPausedRef.current && correctedPlaybackDurationMs > 0) {
        const remainingMs = Math.max(0, correctedPlaybackDurationMs - clampedTimeMs);
        if (remainingMs > 0) {
          playbackTimeMsSV.value = withTiming(correctedPlaybackDurationMs, { // eslint-disable-line react-hooks/exhaustive-deps
            duration: remainingMs,
            easing: Easing.linear,
          });
        }
      }
    },
    [correctedPlaybackDurationMs, updateCurrentRepForPlaybackTime], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Called by the native chart on zoom/pan. Updates SharedValues so the marker
  // tracks the visible x-range on the UI thread without triggering re-renders.
  const onChartChange = useCallback((event: any) => {
    const {left, right, action} = event.nativeEvent ?? {};
    if (typeof left !== 'number' || typeof right !== 'number' || right <= left) {
      return;
    }
    if (action === 'chartScaled' || action === 'chartTranslated') {
      chartVisibleMinSV.value = left; // eslint-disable-line react-hooks/exhaustive-deps
      chartVisibleMaxSV.value = right; // eslint-disable-line react-hooks/exhaustive-deps
      chartVisibleMinRef.current = left;
      chartVisibleMaxRef.current = right;
      chartGestureActiveUntilRef.current = Date.now() + 300;
    }
    if (action === 'chartGestureEnd') {
      setChartVisibleForLines({min: left, max: right});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrubberLayout = useCallback((event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    setScrubberWidth(width);
  }, []);

  const onSpeedChartLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setSpeedChartWidth(width);
    speedChartWidthSV.value = width; // eslint-disable-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap-to-seek maps tap position to the visible time range (zoomed or full).
  const onSpeedChartTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (Date.now() < chartGestureActiveUntilRef.current || speedChartWidth <= 0 || correctedPlaybackDurationMs <= 0) {
        return;
      }
      const drawableWidth = Math.max(0, speedChartWidth - SPEED_CHART_LEFT_PADDING - SPEED_CHART_RIGHT_PADDING);
      if (drawableWidth <= 0) {
        return;
      }
      const x = event.nativeEvent.locationX - SPEED_CHART_LEFT_PADDING;
      const progress = clamp(x / drawableWidth, 0, 1);
      const rangeMin = chartVisibleMinRef.current;
      const rangeMax = chartVisibleMaxRef.current > rangeMin ? chartVisibleMaxRef.current : correctedPlaybackDurationMs;
      applySeekTimeMs(Math.round(rangeMin + progress * (rangeMax - rangeMin)));
    },
    [speedChartWidth, correctedPlaybackDurationMs, applySeekTimeMs],
  );

  const onScrubberTouch = useCallback(
    (locationX: number, width: number) => {
      if (width <= 0 || correctedPlaybackDurationMs <= 0) {
        return;
      }
      const progress = clamp(locationX / width, 0, 1);
      applySeekTimeMs(progress * correctedPlaybackDurationMs);
    },
    [applySeekTimeMs, correctedPlaybackDurationMs],
  );

  // Play/Pause toggle: starts a withTiming animation on Play, cancels it on Pause.
  // Sync between player and marker happens only at user interaction (no onPlayerProgress state updates).
  const onPlayPauseToggle = useCallback(() => {
    const nextPaused = !playbackPausedRef.current;
    playbackPausedRef.current = nextPaused;
    setPlaybackPaused(nextPaused);

    if (!nextPaused && correctedPlaybackDurationMs > 0) {
      // Transitioning to PLAY: animate marker from current position to end.
      const currentMs = playbackTimeMsSV.value; // eslint-disable-line react-hooks/exhaustive-deps
      const remainingMs = Math.max(0, correctedPlaybackDurationMs - currentMs);
      if (remainingMs > 0) {
        playbackTimeMsSV.value = withTiming(correctedPlaybackDurationMs, { // eslint-disable-line react-hooks/exhaustive-deps
          duration: remainingMs,
          easing: Easing.linear,
        });
      }
    } else if (nextPaused) {
      // Transitioning to PAUSE: stop animation, read current position, sync player.
      cancelAnimation(playbackTimeMsSV); // eslint-disable-line react-hooks/exhaustive-deps
      const currentMs = Math.round(playbackTimeMsSV.value); // eslint-disable-line react-hooks/exhaustive-deps
      playbackTimeRef.current = currentMs;
      setPlaybackTimeMs(currentMs);
      setSeekPositionMs(currentMs);
      updateCurrentRepForPlaybackTime(currentMs);
    }
  }, [correctedPlaybackDurationMs, updateCurrentRepForPlaybackTime]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    playbackTimeRef.current = playbackTimeMs;
  }, [playbackTimeMs]);

  const progressMarkerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{translateX: progressMarkerLeft.value}],
  }));

  const onSaveSetResult = useCallback(() => {
    const trackingFrameWidth = result.analysisMeta.trackingFrameWidthPx ?? 0;
    const repResults: VideoAnalysisRepResult[] = result.repSegments.map((seg, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === result.repSegments.length - 1;
      const startMs = seg.startMs;
      const turnaroundMs = isFirst && firstRepTurnaroundOverrideMs !== null ? firstRepTurnaroundOverrideMs
        : isLast && lastRepTurnaroundOverrideMs !== null ? lastRepTurnaroundOverrideMs
        : seg.turnaroundMs;
      const endMs = isFirst && firstRepEndOverrideMs !== null ? firstRepEndOverrideMs
        : isLast && lastRepEndOverrideMs !== null ? lastRepEndOverrideMs
        : seg.endMs;
      const totalTimeMs = endMs - startMs;
      const concentricTimeMs = Math.max(0, endMs - turnaroundMs);
      const eccentricTimeMs = Math.max(0, turnaroundMs - startMs);
      const metrics = calcIntervalMetrics(turnaroundMs, endMs);
      const deviation = calculateBarPathDeviation(smoothedBarPathSeries, startMs, turnaroundMs, endMs, trackingFrameWidth);
      return {
        repIndex: seg.repIndex,
        startMs,
        turnaroundMs,
        endMs,
        totalTimeMs,
        eccentricTimeMs,
        concentricTimeMs,
        vAvg: metrics?.vAvg ?? 0,
        vPeak: metrics?.vPeak ?? 0,
        delta_x: deviation.delta_x,
        path_deviation: deviation.path_deviation,
      };
    });

    const firstVAvg = repResults.length > 0 ? repResults[0].vAvg : 0;
    const lastVAvg = repResults.length > 0 ? repResults[repResults.length - 1].vAvg : 0;
    const vlPercent = firstVAvg > 0 ? Math.round((1 - lastVAvg / firstVAvg) * 100) : null;
    let rir: string | null = null;
    if (vlPercent !== null) {
      if (vlPercent < 10) { rir = '4+'; }
      else if (vlPercent < 20) { rir = '3-4'; }
      else if (vlPercent < 30) { rir = '2-3'; }
      else if (vlPercent < 40) { rir = '1-2'; }
      else { rir = '0-1'; }
    }

    // Set-level path deviation aggregates
    const repDeviations = repResults
      .map((r) => r.path_deviation)
      .filter((d): d is number => d !== undefined && isFinite(d));
    let mean_path_deviation: number | null = null;
    let path_deviation_slope: number | null = null;
    if (repDeviations.length > 0) {
      mean_path_deviation = repDeviations.reduce((s, d) => s + d, 0) / repDeviations.length;
      if (repDeviations.length > 1) {
        // Simple linear regression slope: deviation vs rep index (0-based)
        const n = repDeviations.length;
        const xMean = (n - 1) / 2;
        const yMean = mean_path_deviation;
        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
          num += (i - xMean) * (repDeviations[i] - yMean);
          den += (i - xMean) ** 2;
        }
        path_deviation_slope = den > 0 ? num / den : 0;
      }
    }

    saveSetResult(analysisId, {
      repResults,
      velocityLossPercent: vlPercent,
      rirEstimate: rir,
      calibratedAt: new Date().toISOString(),
      mean_path_deviation,
      path_deviation_slope,
    });
  }, [analysisId, result.repSegments, result.analysisMeta.trackingFrameWidthPx, firstRepTurnaroundOverrideMs, firstRepEndOverrideMs, lastRepTurnaroundOverrideMs, lastRepEndOverrideMs, calcIntervalMetrics, smoothedBarPathSeries, saveSetResult]);

  // Video pinch-to-zoom gesture.
  const videoPinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      videoScaleBase.value = videoScale.value;
    })
    .onUpdate((e) => {
      'worklet';
      videoScale.value = Math.max(1, Math.min(5, videoScaleBase.value * e.scale));
    })
    .onEnd(() => {
      'worklet';
      if (videoScale.value < 1.05) {
        videoScale.value = 1;
        videoTranslateX.value = 0;
        videoTranslateY.value = 0;
      }
    });

  // Video pan gesture (only when zoomed in).
  const videoPanGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      videoTranslateXBase.value = videoTranslateX.value;
      videoTranslateYBase.value = videoTranslateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (videoScale.value <= 1) {
        return;
      }
      videoTranslateX.value = videoTranslateXBase.value + e.translationX;
      videoTranslateY.value = videoTranslateYBase.value + e.translationY;
    });

  const videoZoomStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: videoTranslateX.value},
      {translateY: videoTranslateY.value},
      {scale: videoScale.value},
    ],
  }));

  useEffect(() => {
    cancelAnimation(playbackTimeMsSV); // eslint-disable-line react-hooks/exhaustive-deps
    setPlaybackPaused(true);
    playbackPausedRef.current = true;
    setPlaybackTimeMs(0);
    setPlaybackDurationMs(0);
    setPlaybackVideoWidth(0);
    setPlaybackVideoHeight(0);
    setCurrentRepIndex(undefined);
    setSeekPositionMs(undefined);
    playbackTimeMsSV.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
    videoDurationMsSV.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
    chartVisibleMinSV.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
    chartVisibleMaxSV.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
    chartVisibleMinRef.current = 0;
    chartVisibleMaxRef.current = 0;
    setChartVisibleForLines(null);
    playbackDurationRef.current = 0;
    playbackTimeRef.current = 0;
    currentRepIndexRef.current = undefined;
    isScrubbingRef.current = false;
    videoScale.value = 1; // eslint-disable-line react-hooks/exhaustive-deps
    videoTranslateX.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
    videoTranslateY.value = 0; // eslint-disable-line react-hooks/exhaustive-deps
  }, [localVideoPath, result.analysisMeta.trackingFrameHeightPx, result.analysisMeta.trackingFrameWidthPx, result.barPathSeries, result.repSegments]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <View testID="video-analysis-playback-overlay" style={styles.videoRow}>
        <GestureHandlerRootView style={{flex: 1}}>
        <GestureDetector gesture={Gesture.Simultaneous(videoPinchGesture, videoPanGesture)}>
        <View testID="video-analysis-overlay-card" style={[styles.previewContainer, themedStyles.previewBackground, {aspectRatio: playbackAspectRatio, maxHeight: 520}]}>
          <Animated.View style={[styles.previewImage, videoZoomStyle]}>
          <VideoAnalysisPlayerView
            testID="video-analysis-playback-player"
            style={styles.previewImage}
            source={localVideoPath}
            paused={playbackPaused}
            seekPositionMs={seekPositionMs}
            barPathSeries={smoothedBarPathSeries}
            repSegments={repSegments}
            currentRepIndex={currentRepIndex}
            primaryColor={nativeOverlayColors.primary}
            pathColor={nativeOverlayColors.path}
            trackingFrameWidthPx={result.analysisMeta.trackingFrameWidthPx}
            trackingFrameHeightPx={result.analysisMeta.trackingFrameHeightPx}
            onLoad={onPlayerLoad}
            onProgress={onPlayerProgress}
            onEnd={onPlayerEnd}
          />
          </Animated.View>
          <View style={[styles.videoControlsOverlay, themedStyles.videoControlsBackground]} pointerEvents="box-none">
            <IconButton testID="video-analysis-step-minus200" icon="rewind" size={24} iconColor={theme.colors.primary} onPress={() => applySeekTimeMs(playbackTimeRef.current - 200)} style={styles.videoControlButton} />
            <IconButton testID="video-analysis-step-minus50" icon="skip-previous" size={24} iconColor={theme.colors.primary} onPress={() => applySeekTimeMs(playbackTimeRef.current - 50)} style={styles.videoControlButton} />
            <IconButton testID="video-analysis-playback-toggle" icon={playbackPaused ? 'play' : 'pause'} size={32} iconColor={theme.colors.primary} onPress={onPlayPauseToggle} style={styles.videoControlButton} />
            <IconButton testID="video-analysis-step-plus50" icon="skip-next" size={24} iconColor={theme.colors.primary} onPress={() => applySeekTimeMs(playbackTimeRef.current + 50)} style={styles.videoControlButton} />
            <IconButton testID="video-analysis-step-plus200" icon="fast-forward" size={24} iconColor={theme.colors.primary} onPress={() => applySeekTimeMs(playbackTimeRef.current + 200)} style={styles.videoControlButton} />
          </View>
        </View>
        </GestureDetector>
        </GestureHandlerRootView>
        <View style={styles.videoStatsPanel}>
          <Text variant="labelSmall" style={themedStyles.statsText}>
            {currentRepIndex !== undefined ? `Rep ${currentRepIndex + 1}` : '-'}
          </Text>
          <Text variant="labelSmall" style={themedStyles.statsText}>
            {currentBarVerticalVelocityPxPerSecond !== undefined ? `${Math.round(currentBarVerticalVelocityPxPerSecond)} px/s` : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.speedPlotSection}>
        <View style={styles.speedPlotWrapper}>
          <View testID="video-analysis-playback-speed-chart" onTouchEnd={onSpeedChartTouch}>
            <LineChart
              testID="video-analysis-playback-speed-plot"
              style={[styles.speedPlotContainer, themedStyles.speedPlotBackground]}
              onLayout={onSpeedChartLayout}
              data={speedChartData}
              touchEnabled={true}
              pinchZoom={true}
              doubleTapToZoomEnabled={false}
              scaleXEnabled={true}
              scaleYEnabled={false}
              dragEnabled={true}
              onChange={onChartChange}
              legend={{enabled: false}}
              chartDescription={{text: ''}}
              marker={{enabled: false}}
              viewPortOffsets={{
                left: Math.round(SPEED_CHART_LEFT_PADDING * PixelRatio.get()),
                top: Math.round(4 * PixelRatio.get()),
                right: Math.round(SPEED_CHART_RIGHT_PADDING * PixelRatio.get()),
                bottom: Math.round(4 * PixelRatio.get()),
              }}
              xAxis={{
                enabled: false,
                drawGridLines: false,
                drawAxisLine: false,
                axisMinimum: 0,
                axisMaximum: correctedPlaybackDurationMs > 0 ? correctedPlaybackDurationMs : 1,
              }}
              yAxis={{
                left: {
                  axisMinimum: -verticalVelocityAxisLimit,
                  axisMaximum: verticalVelocityAxisLimit,
                  textColor: speedChartColors.text,
                  gridColor: speedChartColors.grid,
                  axisLineColor: speedChartColors.axis,
                  axisLineWidth: 1,
                },
                right: {
                  enabled: false,
                },
              }}
            />
          </View>
          <Animated.View
            testID="video-analysis-speed-marker"
            pointerEvents="none"
            style={[styles.speedMarkerLine, {backgroundColor: theme.colors.primary}, progressMarkerAnimatedStyle]}
          />
          {speedChartWidth > 0 && correctedPlaybackDurationMs > 0 && (() => {
            const drawableWidth = Math.max(0, speedChartWidth - SPEED_CHART_LEFT_PADDING - SPEED_CHART_RIGHT_PADDING);
            const visMin = chartVisibleForLines?.min ?? 0;
            const visMax = chartVisibleForLines?.max ?? correctedPlaybackDurationMs;
            const visRange = visMax > visMin ? visMax - visMin : correctedPlaybackDurationMs;
            const toX = (timeMs: number) => SPEED_CHART_LEFT_PADDING + ((timeMs - visMin) / visRange) * drawableWidth;
            const STEP_MS = 20;

            const renderRepLines = (
              turnaroundMs: number,
              endMs: number,
              setTurnaround: (ms: number) => void,
              setEnd: (ms: number) => void,
            ) => {
              const tX = toX(turnaroundMs);
              const eX = toX(endMs);
              const tIdx = findNearestBarPathPointIndex(smoothedBarPathSeries, turnaroundMs);
              const eIdx = findNearestBarPathPointIndex(smoothedBarPathSeries, endMs);
              const tVel = tIdx !== undefined && tIdx < smoothedBarVerticalVelocitySeries.length
                ? Math.round(smoothedBarVerticalVelocitySeries[tIdx]) : null;
              const eVel = eIdx !== undefined && eIdx < smoothedBarVerticalVelocitySeries.length
                ? Math.round(smoothedBarVerticalVelocitySeries[eIdx]) : null;
              return (
                <>
                  <View style={[styles.adjustLine, {left: tX}]} pointerEvents="box-none">
                    <View style={[styles.adjustLineStem, {backgroundColor: theme.colors.tertiary}]} />
                    <View style={styles.adjustButtonRow}>
                      <TouchableOpacity onPress={() => setTurnaround(turnaroundMs - STEP_MS)} onLongPress={() => setTurnaround(turnaroundMs - 200)}>
                        <Text style={[styles.adjustButtonText, {color: theme.colors.tertiary}]}>{'\u2039'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setTurnaround(turnaroundMs + STEP_MS)} onLongPress={() => setTurnaround(turnaroundMs + 200)}>
                        <Text style={[styles.adjustButtonText, {color: theme.colors.tertiary}]}>{'\u203A'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.adjustLine, {left: eX}]} pointerEvents="box-none">
                    <View style={styles.adjustButtonRow}>
                      <TouchableOpacity onPress={() => setEnd(endMs - STEP_MS)} onLongPress={() => setEnd(endMs - 200)}>
                        <Text style={[styles.adjustButtonText, {color: theme.colors.tertiary}]}>{'\u2039'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEnd(endMs + STEP_MS)} onLongPress={() => setEnd(endMs + 200)}>
                        <Text style={[styles.adjustButtonText, {color: theme.colors.tertiary}]}>{'\u203A'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.adjustLineStem, {backgroundColor: theme.colors.tertiary}]} />
                  </View>
                  {tVel !== null && <Text style={[styles.adjustVelLabel, {color: theme.colors.tertiary, left: tX + 4, top: 2}]}>{tVel}</Text>}
                  {eVel !== null && <Text style={[styles.adjustVelLabel, {color: theme.colors.tertiary, left: eX + 4, bottom: 2}]}>{eVel}</Text>}
                </>
              );
            };

            if (!showCalibration) { return null; }
            return (
              <>
                {firstRepSegment && renderRepLines(firstRepTurnaroundMs, firstRepEndMs, setFirstRepTurnaroundOverrideMs, setFirstRepEndOverrideMs)}
                {lastRepSegment && renderRepLines(lastRepTurnaroundMs, lastRepEndMs, setLastRepTurnaroundOverrideMs, setLastRepEndOverrideMs)}
              </>
            );
          })()}
        </View>
      </View>

      <View style={styles.playbackControls}>
        <View
          testID="video-analysis-playback-scrubber"
          style={[styles.scrubberTrack, themedStyles.scrubberTrack]}
          onLayout={onScrubberLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            isScrubbingRef.current = true;
            onScrubberTouch(event.nativeEvent.locationX, scrubberWidth);
          }}
          onResponderMove={(event) => onScrubberTouch(event.nativeEvent.locationX, scrubberWidth)}
          onResponderRelease={() => {
            isScrubbingRef.current = false;
          }}
          onResponderTerminate={() => {
            isScrubbingRef.current = false;
          }}>
          <Animated.View testID="video-analysis-playback-scrubber-fill" style={[styles.scrubberFill, themedStyles.scrubberFill, scrubberFillStyle]} />
          <Animated.View testID="video-analysis-playback-scrubber-thumb" style={[styles.scrubberThumb, themedStyles.scrubberThumb, scrubberThumbStyle]} />
        </View>
      </View>

      {result.repMetrics.length > 0 && (
        <View testID="video-analysis-rep-summary" style={styles.repSummarySection}>
          <Text variant="labelMedium" style={styles.repSummaryTitle}>
            Rep Summary ({result.repMetrics.length} {result.repMetrics.length === 1 ? 'rep' : 'reps'})
          </Text>
          <View style={styles.tableHeader}>
            <Text variant="labelSmall" style={styles.tableColRep}>Rep</Text>
            <Text variant="labelSmall" style={styles.tableCol}>Total</Text>
            <Text variant="labelSmall" style={styles.tableCol}>Ecc</Text>
            <Text variant="labelSmall" style={styles.tableCol}>Conc</Text>
            <Text variant="labelSmall" style={styles.tableCol}>vAvg</Text>
            <Text variant="labelSmall" style={styles.tableCol}>Dev</Text>
          </View>
          {result.repMetrics.map((metric, idx) => {
            const isFirstRep = idx === 0;
            const isLastRep = idx === result.repMetrics.length - 1;
            const saved = savedSetResult?.repResults?.[idx];
            const seg = repSegments[idx];
            const concTimeMs = saved ? saved.concentricTimeMs
              : isFirstRep && firstRepSegment ? firstRepConcentricTimeMs
              : isLastRep && lastRepSegment ? lastRepConcentricTimeMs
              : seg ? Math.max(0, seg.endMs - seg.turnaroundMs)
              : (metric.concentricTimeMs ?? 0);
            const eccTimeMs = saved ? saved.eccentricTimeMs : (metric.repTimeMs - concTimeMs);
            const totalTimeMs = saved ? saved.totalTimeMs : metric.repTimeMs;
            const vAvg = saved ? saved.vAvg : Math.round(metric.averageConcentricSpeedPxPerS);
            const pathDev = saved?.path_deviation;
            return (
              <View
                key={metric.repIndex}
                testID={`video-analysis-rep-metric-${metric.repIndex}`}
                style={[styles.tableRow, themedStyles.repMetricAccent]}>
                <Text variant="bodySmall" style={styles.tableColRep}>{metric.repIndex + 1}</Text>
                <Text testID={`video-analysis-rep-time-${metric.repIndex}`} variant="bodySmall" style={styles.tableCol}>
                  {(totalTimeMs / 1000).toFixed(2)}s
                </Text>
                <Text variant="bodySmall" style={styles.tableCol}>
                  {eccTimeMs > 0 ? `${(eccTimeMs / 1000).toFixed(2)}s` : '-'}
                </Text>
                <Text testID={`video-analysis-rep-conc-${metric.repIndex}`} variant="bodySmall" style={styles.tableCol}>
                  {concTimeMs > 0 ? `${(concTimeMs / 1000).toFixed(2)}s` : '-'}
                </Text>
                <Text testID={`video-analysis-rep-speed-${metric.repIndex}`} variant="bodySmall" style={styles.tableCol}>
                  {vAvg}
                </Text>
                <Text testID={`video-analysis-rep-path-dev-${metric.repIndex}`} variant="bodySmall" style={styles.tableCol}>
                  {pathDev !== undefined ? `${(pathDev * 100).toFixed(1)}%` : '-'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      {repSegments.length > 0 && (
        <View style={styles.calibrateRow}>
          <IconButton
            icon={showCalibration ? 'chevron-up' : 'tune'}
            size={20}
            iconColor={theme.colors.tertiary}
            onPress={() => setShowCalibration(!showCalibration)}
            style={styles.calibrateButton}
          />
          {showCalibration && (
            <IconButton
              icon="content-save"
              size={20}
              iconColor={theme.colors.primary}
              onPress={onSaveSetResult}
              style={styles.calibrateButton}
            />
          )}
        </View>
      )}
      {firstRepIntervalMetrics && (
        <View style={styles.intervalMetrics}>
          <Text variant="labelMedium" style={styles.repSummaryTitle}>Concentric Phase (Rep 1)</Text>
          <View style={styles.intervalMetricsRow}>
            <Text variant="bodySmall">t={(firstRepIntervalMetrics.timeMs / 1000).toFixed(2)}s</Text>
            <Text variant="bodySmall">vPeak={firstRepIntervalMetrics.vPeak} px/s</Text>

            <Text variant="bodySmall">vAvg={firstRepIntervalMetrics.vAvg} px/s</Text>
          </View>
        </View>
      )}
      {lastRepIntervalMetrics && (
        <View style={styles.intervalMetrics}>
          <Text variant="labelMedium" style={styles.repSummaryTitle}>Concentric Phase (Last Rep)</Text>
          <View style={styles.intervalMetricsRow}>
            <Text variant="bodySmall">t={(lastRepIntervalMetrics.timeMs / 1000).toFixed(2)}s</Text>
            <Text variant="bodySmall">vPeak={lastRepIntervalMetrics.vPeak} px/s</Text>

            <Text variant="bodySmall">vAvg={lastRepIntervalMetrics.vAvg} px/s</Text>
          </View>
        </View>
      )}
      {(velocityLoss !== null || savedSetResult?.velocityLossPercent !== undefined) && (
        <View style={styles.intervalMetrics}>
          <Text variant="labelMedium" style={styles.repSummaryTitle}>Velocity Loss</Text>
          <View style={styles.intervalMetricsRow}>
            <Text variant="bodySmall">VL={savedSetResult?.velocityLossPercent ?? velocityLoss}%</Text>
            {(savedSetResult?.rirEstimate ?? rirEstimate) && (
              <Text variant="bodySmall">RIR={savedSetResult?.rirEstimate ?? rirEstimate}</Text>
            )}
          </View>
        </View>
      )}
      {(savedSetResult?.mean_path_deviation != null || savedSetResult?.path_deviation_slope != null) && (
        <View testID="video-analysis-bar-drift" style={styles.intervalMetrics}>
          <Text variant="labelMedium" style={styles.repSummaryTitle}>Bar Drift (Ecc vs Con)</Text>
          <View style={styles.intervalMetricsRow}>
            {savedSetResult.mean_path_deviation != null && (
              <Text testID="video-analysis-mean-path-deviation" variant="bodySmall">
                Ø Dev={(savedSetResult.mean_path_deviation * 100).toFixed(1)}%
              </Text>
            )}
            {savedSetResult.path_deviation_slope != null && (
              <Text testID="video-analysis-path-deviation-slope" variant="bodySmall">
                Slope={(savedSetResult.path_deviation_slope * 100).toFixed(2)}%/rep
              </Text>
            )}
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  previewContainer: {
    width: '100%',
    minHeight: 260,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoStatsPanel: {
    width: 64,
    paddingLeft: 8,
    alignItems: 'flex-start',
  },
  videoControlsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
    // backgroundColor set via themedStyles.videoControlsBackground
  },
  videoControlButton: {
    margin: 0,
  },
  repSummarySection: {
    marginTop: 12,
  },
  repSummaryTitle: {
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderRadius: 4,
    marginBottom: 1,
  },
  tableColRep: {
    width: 30,
    textAlign: 'center',
  },
  tableCol: {
    flex: 1,
    textAlign: 'right',
  },
  adjustLine: {
    position: 'absolute',
    top: 0,
    height: SPEED_PLOT_HEIGHT,
    alignItems: 'center',
    width: 14,
    marginLeft: -7,
  },
  adjustLineStem: {
    width: 1.5,
    flex: 1,
  },
  adjustButtonRow: {
    flexDirection: 'row',
    gap: 4,
  },
  adjustButtonText: {
    fontSize: 33,
    fontWeight: '700',
    lineHeight: 36,
    textAlign: 'center',
    minWidth: 33,
  },
  adjustLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  adjustVelLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '700',
  },
  calibrateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  calibrateButton: {
    margin: 0,
  },
  intervalMetrics: {
    marginTop: 8,
  },
  intervalMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  playbackControls: {
    marginTop: 10,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartSpeedText: {
    marginTop: 2,
  },
  chartAxisRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  speedPlotSection: {
    marginTop: 0,
  },
  speedPlotWrapper: {
    position: 'relative',
    marginTop: 0,
  },
  speedPlotContainer: {
    position: 'relative',
    height: SPEED_PLOT_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
  },
  speedMarkerLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2,
    height: SPEED_PLOT_HEIGHT,
    opacity: 0.75,
  },
  scrubberTrack: {
    position: 'relative',
    height: 14,
    borderRadius: 999,
    marginTop: 12,
    overflow: 'visible',
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
  stepButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 4,
  },
});

export default memo(VideoAnalysisPlaybackOverlayCard);
