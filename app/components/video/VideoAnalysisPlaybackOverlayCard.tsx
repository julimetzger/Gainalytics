import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {GestureResponderEvent, LayoutChangeEvent, PixelRatio, StyleSheet, View, processColor} from 'react-native';
import Animated, {Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming} from 'react-native-reanimated';
import {Button, MD3Theme, Text, useTheme} from 'react-native-paper';
import {LineChart, LineValue} from 'react-native-charts-wrapper';
import {BarPathPoint, BarTrackingResult, RepSegment} from '../../models/entities/VideoAnalysis';
import VideoAnalysisPlayerView, {VideoPlayerLoadEvent, VideoPlayerProgressEvent} from './VideoAnalysisPlayerView';

interface Props {
  localVideoPath: string;
  result: BarTrackingResult;
}

interface TimeRange {
  minTimeMs: number;
  maxTimeMs: number;
  durationMs: number;
}

interface OverlayPoint {
  key: string;
  x: number;
  y: number;
}

const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;
const SPEED_PLOT_HEIGHT = 180;
// Left offset of the chart drawable area (dp). Used for JS layout (translateX, touch mapping).
// viewPortOffsets.left must be SPEED_CHART_LEFT_PADDING * PixelRatio.get() because
// MPAndroidChart's setViewPortOffsets() expects physical pixels, not dp.
const SPEED_CHART_LEFT_PADDING = 64;
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

const mapBarPathToOverlay = (
  barPathSeries: BarPathPoint[],
  overlayWidth: number,
  overlayHeight: number,
  videoWidth: number,
  videoHeight: number,
  trackingFrameWidthPx?: number,
  trackingFrameHeightPx?: number,
): OverlayPoint[] => {
  if (barPathSeries.length === 0 || overlayWidth <= 0 || overlayHeight <= 0) {
    return [];
  }

  const sourceWidth = trackingFrameWidthPx && trackingFrameWidthPx > 0 ? trackingFrameWidthPx : videoWidth > 0 ? videoWidth : overlayWidth;
  const sourceHeight = trackingFrameHeightPx && trackingFrameHeightPx > 0 ? trackingFrameHeightPx : videoHeight > 0 ? videoHeight : overlayHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return [];
  }

  const scale = Math.min(overlayWidth / sourceWidth, overlayHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (overlayWidth - renderedWidth) / 2;
  const offsetY = (overlayHeight - renderedHeight) / 2;

  if (trackingFrameWidthPx && trackingFrameHeightPx && trackingFrameWidthPx > 0 && trackingFrameHeightPx > 0) {
    return barPathSeries.map((point, index) => ({
      key: `${point.tMs}-${index}`,
      x: offsetX + point.x * (renderedWidth / trackingFrameWidthPx),
      y: offsetY + point.y * (renderedHeight / trackingFrameHeightPx),
    }));
  }

  const xValues = barPathSeries.map((point) => point.x);
  const yValues = barPathSeries.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xSpan = Math.max(1, maxX - minX);
  const ySpan = Math.max(1, maxY - minY);

  return barPathSeries.map((point, index) => ({
    key: `${point.tMs}-${index}`,
    x: offsetX + ((point.x - minX) / xSpan) * renderedWidth,
    y: offsetY + ((point.y - minY) / ySpan) * renderedHeight,
  }));
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
    historyPoint: {
      backgroundColor: theme.colors.onSurfaceVariant,
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
  });

const VideoAnalysisPlaybackOverlayCard = ({localVideoPath, result}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
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
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [playbackVideoWidth, setPlaybackVideoWidth] = useState(0);
  const [playbackVideoHeight, setPlaybackVideoHeight] = useState(0);
  const [currentRepIndex, setCurrentRepIndex] = useState<number | undefined>();
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [seekPositionMs, setSeekPositionMs] = useState<number | undefined>(undefined);
  const [speedChartWidth, setSpeedChartWidth] = useState(0);

  // useRef wrapper ensures the SharedValue object is stable across renders.
  // The Reanimated mock creates a new plain object on each useSharedValue call,
  // so without useRef the animated styles would always see value=0 in tests.
  const playbackTimeMsSV = useRef(useSharedValue(0)).current;
  // Tracks actual video duration as a SharedValue for UI-thread marker/scrubber animations.
  const videoDurationMsSV = useRef(useSharedValue(0)).current;
  const speedChartWidthSV = useRef(useSharedValue(0)).current;

  const playbackDurationRef = useRef(0);
  const playbackTimeRef = useRef(0);
  const playbackPausedRef = useRef(true);
  const currentRepIndexRef = useRef<number | undefined>(undefined);
  const isScrubbingRef = useRef(false);

  const repSegments = result.repSegments;
  const smoothedBarPathSeries = useMemo(() => smoothBarPathSeries(result.barPathSeries), [result.barPathSeries]);
  const smoothedBarVerticalVelocitySeries = useMemo(() => calculateBarVerticalVelocitySeries(smoothedBarPathSeries), [smoothedBarPathSeries]);
  const timeRange = useMemo(() => getTimeRange(smoothedBarPathSeries), [smoothedBarPathSeries]);
  const correctedPlaybackDurationMs = useMemo(() => {
    return Math.max(playbackDurationMs, timeRange.maxTimeMs);
  }, [playbackDurationMs, timeRange.maxTimeMs]);

  // Keep videoDurationMsSV in sync with correctedPlaybackDurationMs for UI-thread animations.
  // SharedValue intentionally excluded from deps (stable ref, memory entry #16).
  useEffect(() => {
    if (correctedPlaybackDurationMs > 0) {
      videoDurationMsSV.value = correctedPlaybackDurationMs; // eslint-disable-line react-hooks/exhaustive-deps
    }
  }, [correctedPlaybackDurationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const progressMarkerLeft = useDerivedValue(() => {
    'worklet';
    if (speedChartWidthSV.value <= 0) {
      return 0;
    }
    const drawableWidth = Math.max(0, speedChartWidthSV.value - SPEED_CHART_LEFT_PADDING - SPEED_CHART_RIGHT_PADDING);
    if (videoDurationMsSV.value <= 0) {
      return SPEED_CHART_LEFT_PADDING;
    }

    // Keep the marker on the same 0..videoDuration timeline as the scrubber and player.
    // The chart uses the same domain, so non-zero minTimeMs values naturally shift the data
    // to the right while the marker still starts at the chart's left edge at t=0.
    const progress = Math.min(1, Math.max(0, playbackTimeMsSV.value / videoDurationMsSV.value));
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
  const historyOverlayPoints = useMemo(
    () =>
      mapBarPathToOverlay(
        smoothedBarPathSeries,
        overlayWidth,
        overlayHeight,
        playbackVideoWidth,
        playbackVideoHeight,
        result.analysisMeta.trackingFrameWidthPx,
        result.analysisMeta.trackingFrameHeightPx,
      ),
    [
      overlayHeight,
      overlayWidth,
      playbackVideoHeight,
      playbackVideoWidth,
      result.analysisMeta.trackingFrameHeightPx,
      result.analysisMeta.trackingFrameWidthPx,
      smoothedBarPathSeries,
    ],
  );
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

  // onPlayerProgress ONLY updates playbackDurationMs — no time-driven state updates.
  // The marker and scrubber are animated via withTiming on the UI thread during playback.
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
    },
    [],
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

  const onOverlayLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setOverlayWidth(width);
    setOverlayHeight(height);
  }, []);

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

  const onScrubberLayout = useCallback((event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    setScrubberWidth(width);
  }, []);

  const onSpeedChartLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setSpeedChartWidth(width);
    speedChartWidthSV.value = width; // eslint-disable-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap-to-seek maps tap position to VIDEO TIME (0..videoDuration).
  const onSpeedChartTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (speedChartWidth <= 0 || correctedPlaybackDurationMs <= 0) {
        return;
      }
      const drawableWidth = Math.max(0, speedChartWidth - SPEED_CHART_LEFT_PADDING - SPEED_CHART_RIGHT_PADDING);
      if (drawableWidth <= 0) {
        return;
      }
      const x = event.nativeEvent.locationX - SPEED_CHART_LEFT_PADDING;
      const progress = clamp(x / drawableWidth, 0, 1);
      applySeekTimeMs(Math.round(progress * correctedPlaybackDurationMs));
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
    playbackDurationRef.current = 0;
    playbackTimeRef.current = 0;
    currentRepIndexRef.current = undefined;
    isScrubbingRef.current = false;
  }, [localVideoPath, result.analysisMeta.trackingFrameHeightPx, result.analysisMeta.trackingFrameWidthPx, result.barPathSeries, result.repSegments]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Text style={styles.overlayHint}>Live playback with current detected bar position.</Text>
      <View testID="video-analysis-playback-overlay" style={[styles.previewContainer, themedStyles.previewBackground, {aspectRatio: playbackAspectRatio}]} onLayout={onOverlayLayout}>
        <VideoAnalysisPlayerView
          testID="video-analysis-playback-player"
          style={styles.previewImage}
          source={localVideoPath}
          paused={playbackPaused}
          seekPositionMs={seekPositionMs}
          barPathSeries={smoothedBarPathSeries}
          trackingFrameWidthPx={result.analysisMeta.trackingFrameWidthPx}
          trackingFrameHeightPx={result.analysisMeta.trackingFrameHeightPx}
          onLoad={onPlayerLoad}
          onProgress={onPlayerProgress}
          onEnd={onPlayerEnd}
        />
        <View pointerEvents="none" style={styles.historyOverlayLayer}>
          {historyOverlayPoints.map((point) => (
            <View
              key={point.key}
              style={[
                styles.historyPoint,
                themedStyles.historyPoint,
                {
                  left: point.x - 1,
                  top: point.y - 1,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.speedPlotSection}>
        <View style={styles.chartHeaderRow}>
          <Text variant="labelMedium">Bar v_y Over Time</Text>
          <Text testID="video-analysis-playback-speed" variant="bodySmall" style={styles.chartSpeedText}>
            v_y={currentBarVerticalVelocityPxPerSecond !== undefined ? Math.round(currentBarVerticalVelocityPxPerSecond) : '-'} px/s
          </Text>
        </View>
        <View style={styles.speedPlotWrapper}>
          <View testID="video-analysis-playback-speed-chart" onTouchEnd={onSpeedChartTouch}>
            <LineChart
              testID="video-analysis-playback-speed-plot"
              style={[styles.speedPlotContainer, themedStyles.speedPlotBackground]}
              onLayout={onSpeedChartLayout}
              data={speedChartData}
              touchEnabled={false}
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
        </View>
        <View style={styles.chartAxisRow}>
          <Text variant="bodySmall">down (-)</Text>
          <Text variant="bodySmall">{currentBarVerticalVelocityPxPerSecond !== undefined ? `${Math.round(currentBarVerticalVelocityPxPerSecond)} px/s` : '-'}</Text>
          <Text variant="bodySmall">up (+)</Text>
        </View>
        <View style={styles.chartAxisRow}>
          <Text variant="bodySmall">t=0:00</Text>
          <Text variant="bodySmall">{formatDuration(correctedPlaybackDurationMs)}</Text>
        </View>
      </View>

      <View style={styles.playbackControls}>
        <Button testID="video-analysis-playback-toggle" mode="outlined" onPress={onPlayPauseToggle}>
          {playbackPaused ? 'Play' : 'Pause'}
        </Button>
        <Text testID="video-analysis-playback-time">
          Playback: {formatDuration(playbackTimeMs)} / {formatDuration(correctedPlaybackDurationMs)}
        </Text>
        <Text>{currentRepIndex !== undefined ? `Current Rep: ${currentRepIndex}` : 'Current Rep: -'}</Text>
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
        <View style={styles.stepButtonsRow}>
          <Button testID="video-analysis-step-minus200" mode="outlined" compact onPress={() => applySeekTimeMs(playbackTimeRef.current - 200)}>
            -0.2s
          </Button>
          <Button testID="video-analysis-step-minus50" mode="outlined" compact onPress={() => applySeekTimeMs(playbackTimeRef.current - 50)}>
            -0.05s
          </Button>
          <Button testID="video-analysis-step-plus50" mode="outlined" compact onPress={() => applySeekTimeMs(playbackTimeRef.current + 50)}>
            +0.05s
          </Button>
          <Button testID="video-analysis-step-plus200" mode="outlined" compact onPress={() => applySeekTimeMs(playbackTimeRef.current + 200)}>
            +0.2s
          </Button>
        </View>
      </View>
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
  historyOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  historyPoint: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.18,
  },
  overlayHint: {
    marginBottom: 10,
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
    marginTop: 12,
  },
  speedPlotWrapper: {
    position: 'relative',
    marginTop: 8,
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
    width: 4,
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
