import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View, processColor} from 'react-native';
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

interface OverlayLineSegment {
  key: string;
  centerX: number;
  centerY: number;
  width: number;
  angleRad: number;
}

interface TimePlotPoint {
  key: string;
  x: number;
  y: number;
}

const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;
const TIME_PLOT_HEIGHT = 112;
const SPEED_PLOT_HEIGHT = 180;
const BAR_PATH_SMOOTHING_WINDOW = 5;
const SPEED_SMOOTHING_WINDOW = 5;
const PLAYBACK_UI_UPDATE_INTERVAL_MS = 50;
const PENDING_SEEK_MATCH_THRESHOLD_MS = 200;
const PATH_SEGMENT_THICKNESS = 4;

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

const buildOverlayLineSegments = (overlayPoints: OverlayPoint[]): OverlayLineSegment[] => {
  if (overlayPoints.length < 2) {
    return [];
  }

  const segments: OverlayLineSegment[] = [];
  for (let index = 1; index < overlayPoints.length; index += 1) {
    const previousPoint = overlayPoints[index - 1];
    const nextPoint = overlayPoints[index];
    const deltaX = nextPoint.x - previousPoint.x;
    const deltaY = nextPoint.y - previousPoint.y;
    const width = Math.hypot(deltaX, deltaY);
    if (width < 1) {
      continue;
    }

    segments.push({
      key: `${previousPoint.key}-${nextPoint.key}`,
      centerX: (previousPoint.x + nextPoint.x) / 2,
      centerY: (previousPoint.y + nextPoint.y) / 2,
      width,
      angleRad: Math.atan2(deltaY, deltaX),
    });
  }

  return segments;
};

const selectOverlayPointsForRep = (
  overlayPoints: OverlayPoint[],
  barPathSeries: BarPathPoint[],
  repSegment: RepSegment | undefined,
): OverlayPoint[] => {
  if (!repSegment || overlayPoints.length === 0 || barPathSeries.length === 0) {
    return [];
  }

  return overlayPoints.filter((_, index) => {
    const point = barPathSeries[index];
    return !!point && point.tMs >= repSegment.startMs && point.tMs <= repSegment.endMs;
  });
};

const mapBarPathToTimePlot = (barPathSeries: BarPathPoint[], plotWidth: number, plotHeight: number, trackingFrameHeightPx?: number): TimePlotPoint[] => {
  if (barPathSeries.length === 0 || plotWidth <= 0 || plotHeight <= 0) {
    return [];
  }

  const timeRange = getTimeRange(barPathSeries);
  const minY = 0;
  const maxY = trackingFrameHeightPx && trackingFrameHeightPx > 0 ? trackingFrameHeightPx : Math.max(...barPathSeries.map((point) => point.y));
  const ySpan = Math.max(1, maxY - minY);

  return barPathSeries.map((point, index) => {
    const xProgress = timeRange.durationMs > 0 ? (point.tMs - timeRange.minTimeMs) / timeRange.durationMs : 0;
    const yProgress = (point.y - minY) / ySpan;

    return {
      key: `time-plot-${point.tMs}-${index}`,
      x: xProgress * plotWidth,
      y: clamp(yProgress, 0, 1) * plotHeight,
    };
  });
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

const buildVerticalProgressLine = (timeMs: number, minY: number, maxY: number): LineValue[] => {
  return [
    {x: timeMs, y: minY},
    {x: timeMs, y: maxY},
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
    timePlotBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    timePlotPoint: {
      backgroundColor: theme.colors.outline,
    },
    timePlotMarker: {
      backgroundColor: theme.colors.primary,
    },
    timePlotMarkerLine: {
      backgroundColor: theme.colors.primary,
    },
    speedPlotBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    activeRepPathSegment: {
      backgroundColor: theme.colors.primary,
    },
    backgroundRepPathSegment: {
      backgroundColor: theme.colors.onSurfaceVariant,
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
  const [timePlotWidth, setTimePlotWidth] = useState(0);
  const [seekPositionMs, setSeekPositionMs] = useState<number | undefined>(undefined);

  const playbackDurationRef = useRef(0);
  const latestProgressTimeRef = useRef(0);
  const playbackTimeRef = useRef(0);
  const lastRenderedPlaybackBucketRef = useRef(-1);
  const currentRepIndexRef = useRef<number | undefined>(undefined);
  const pendingSeekTargetMsRef = useRef<number | undefined>(undefined);
  const pendingSeekDeadlineMsRef = useRef(0);
  const isScrubbingRef = useRef(false);

  const repSegments = result.repSegments;
  const smoothedBarPathSeries = useMemo(() => smoothBarPathSeries(result.barPathSeries), [result.barPathSeries]);
  const smoothedBarVerticalVelocitySeries = useMemo(() => calculateBarVerticalVelocitySeries(smoothedBarPathSeries), [smoothedBarPathSeries]);
  const timeRange = useMemo(() => getTimeRange(smoothedBarPathSeries), [smoothedBarPathSeries]);
  const correctedPlaybackDurationMs = useMemo(() => {
    if (playbackDurationMs > 0) {
      return playbackDurationMs;
    }
    return timeRange.durationMs;
  }, [playbackDurationMs, timeRange.durationMs]);
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
  const activeRepSegment = useMemo(
    () => repSegments.find((segment) => segment.repIndex === currentRepIndex),
    [currentRepIndex, repSegments],
  );
  const activeRepOverlayPoints = useMemo(
    () => selectOverlayPointsForRep(historyOverlayPoints, smoothedBarPathSeries, activeRepSegment),
    [activeRepSegment, historyOverlayPoints, smoothedBarPathSeries],
  );
  const activeRepOverlaySegments = useMemo(() => buildOverlayLineSegments(activeRepOverlayPoints), [activeRepOverlayPoints]);
  const historyOverlaySegments = useMemo(() => buildOverlayLineSegments(historyOverlayPoints), [historyOverlayPoints]);
  const scrubberProgress = correctedPlaybackDurationMs > 0 ? clamp(playbackTimeMs / correctedPlaybackDurationMs, 0, 1) : 0;
  const timePlotPoints = useMemo(
    () => mapBarPathToTimePlot(smoothedBarPathSeries, timePlotWidth, TIME_PLOT_HEIGHT, result.analysisMeta.trackingFrameHeightPx),
    [result.analysisMeta.trackingFrameHeightPx, smoothedBarPathSeries, timePlotWidth],
  );
  const verticalVelocityLineValues = useMemo(() => mapVerticalVelocitySeriesToLineValues(smoothedBarPathSeries, smoothedBarVerticalVelocitySeries), [
    smoothedBarPathSeries,
    smoothedBarVerticalVelocitySeries,
  ]);
  const currentBarPathPointIndex = useMemo(
    () => findNearestBarPathPointIndex(smoothedBarPathSeries, playbackTimeMs),
    [playbackTimeMs, smoothedBarPathSeries],
  );
  const currentBarPathPoint = useMemo(
    () => (currentBarPathPointIndex !== undefined ? smoothedBarPathSeries[currentBarPathPointIndex] : undefined),
    [currentBarPathPointIndex, smoothedBarPathSeries],
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
  const progressVelocityLineValues = useMemo(() => {
    if (smoothedBarPathSeries.length === 0) {
      return [];
    }
    const clampedTimeMs = clamp(playbackTimeMs, timeRange.minTimeMs, timeRange.maxTimeMs);
    return buildVerticalProgressLine(clampedTimeMs, -verticalVelocityAxisLimit, verticalVelocityAxisLimit);
  }, [playbackTimeMs, smoothedBarPathSeries.length, timeRange.maxTimeMs, timeRange.minTimeMs, verticalVelocityAxisLimit]);
  const currentTimePlotMarker = useMemo(() => {
    if (timePlotWidth <= 0 || !currentBarPathPoint) {
      return undefined;
    }

    const timeX = correctedPlaybackDurationMs > 0 ? clamp(playbackTimeMs / correctedPlaybackDurationMs, 0, 1) * timePlotWidth : 0;
    const maxY =
      result.analysisMeta.trackingFrameHeightPx && result.analysisMeta.trackingFrameHeightPx > 0
        ? result.analysisMeta.trackingFrameHeightPx
        : Math.max(1, ...smoothedBarPathSeries.map((point) => point.y));
    const markerY = clamp(currentBarPathPoint.y / Math.max(1, maxY), 0, 1) * TIME_PLOT_HEIGHT;

    return {
      x: timeX,
      y: markerY,
    };
  }, [correctedPlaybackDurationMs, currentBarPathPoint, playbackTimeMs, result.analysisMeta.trackingFrameHeightPx, smoothedBarPathSeries, timePlotWidth]);

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

  const commitPlaybackTimeMs = useCallback((nextTimeMs: number, force = false): boolean => {
    const clampedTimeMs = Math.max(0, Math.round(nextTimeMs));
    playbackTimeRef.current = clampedTimeMs;

    const nextUiBucket = Math.floor(clampedTimeMs / PLAYBACK_UI_UPDATE_INTERVAL_MS);
    if (!force && nextUiBucket === lastRenderedPlaybackBucketRef.current) {
      return false;
    }

    lastRenderedPlaybackBucketRef.current = nextUiBucket;
    setPlaybackTimeMs((previousMs) => {
      if (previousMs === clampedTimeMs) {
        return previousMs;
      }
      return clampedTimeMs;
    });
    return true;
  }, []);

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

  const onPlayerProgress = useCallback(
    (event: {nativeEvent?: VideoPlayerProgressEvent}) => {
      const nativeEvent = event.nativeEvent;
      if (!nativeEvent) {
        return;
      }

      const currentTimeMs = nativeEvent.currentTimeMs;

      if (isScrubbingRef.current) {
        return;
      }

      const nowMs = Date.now();
      const pendingSeekTargetMs = pendingSeekTargetMsRef.current;
      if (pendingSeekTargetMs !== undefined && nowMs < pendingSeekDeadlineMsRef.current) {
        if (Math.abs(currentTimeMs - pendingSeekTargetMs) > PENDING_SEEK_MATCH_THRESHOLD_MS) {
          return;
        }
        pendingSeekTargetMsRef.current = undefined;
      } else if (pendingSeekTargetMs !== undefined && nowMs >= pendingSeekDeadlineMsRef.current) {
        pendingSeekTargetMsRef.current = undefined;
      }

      if (currentTimeMs < latestProgressTimeRef.current) {
        return;
      }
      latestProgressTimeRef.current = currentTimeMs;

      if (nativeEvent.durationMs > 0) {
        const nextDuration = Math.max(playbackDurationRef.current, nativeEvent.durationMs);
        if (nextDuration !== playbackDurationRef.current) {
          playbackDurationRef.current = nextDuration;
          setPlaybackDurationMs(nextDuration);
        }
      }

      if (playbackPaused) {
        const didCommit = commitPlaybackTimeMs(currentTimeMs);
        if (didCommit) {
          updateCurrentRepForPlaybackTime(currentTimeMs);
        }
        return;
      }

      const didCommit = commitPlaybackTimeMs(currentTimeMs);
      if (didCommit) {
        updateCurrentRepForPlaybackTime(currentTimeMs);
      }
    },
    [commitPlaybackTimeMs, playbackPaused, updateCurrentRepForPlaybackTime],
  );

  const onPlayerEnd = useCallback(() => {
    setPlaybackPaused(true);
    const finalTimeMs = Math.max(playbackDurationRef.current, latestProgressTimeRef.current);
    commitPlaybackTimeMs(finalTimeMs, true);
    updateCurrentRepForPlaybackTime(finalTimeMs);
  }, [commitPlaybackTimeMs, updateCurrentRepForPlaybackTime]);

  const onOverlayLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setOverlayWidth(width);
    setOverlayHeight(height);
  }, []);

  const applySeekTimeMs = useCallback(
    (nextTimeMs: number) => {
      const clampedTimeMs = clamp(Math.round(nextTimeMs), 0, correctedPlaybackDurationMs);
      latestProgressTimeRef.current = clampedTimeMs;
      playbackTimeRef.current = clampedTimeMs;
      pendingSeekTargetMsRef.current = clampedTimeMs;
      pendingSeekDeadlineMsRef.current = Date.now() + PENDING_SEEK_MATCH_THRESHOLD_MS;
      commitPlaybackTimeMs(clampedTimeMs, true);
      setSeekPositionMs(clampedTimeMs);
      updateCurrentRepForPlaybackTime(clampedTimeMs);
    },
    [commitPlaybackTimeMs, correctedPlaybackDurationMs, updateCurrentRepForPlaybackTime],
  );

  const onScrubberLayout = useCallback((event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    setScrubberWidth(width);
  }, []);

  const onTimePlotLayout = useCallback((event: LayoutChangeEvent) => {
    setTimePlotWidth(event.nativeEvent.layout.width);
  }, []);

  const onSpeedChartSelect = useCallback(
    (event: {nativeEvent?: {x?: number}}) => {
      const x = event.nativeEvent?.x;
      if (x === undefined) {
        return;
      }
      applySeekTimeMs(x);
    },
    [applySeekTimeMs],
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

  useEffect(() => {
    playbackTimeRef.current = playbackTimeMs;
  }, [playbackTimeMs]);

  useEffect(() => {
    setPlaybackPaused(true);
    setPlaybackTimeMs(0);
    setPlaybackDurationMs(0);
    setPlaybackVideoWidth(0);
    setPlaybackVideoHeight(0);
    setCurrentRepIndex(undefined);
    setSeekPositionMs(undefined);
    playbackDurationRef.current = 0;
    latestProgressTimeRef.current = 0;
    playbackTimeRef.current = 0;
    lastRenderedPlaybackBucketRef.current = -1;
    currentRepIndexRef.current = undefined;
    pendingSeekTargetMsRef.current = undefined;
    pendingSeekDeadlineMsRef.current = 0;
    isScrubbingRef.current = false;
  }, [localVideoPath, result.analysisMeta.trackingFrameHeightPx, result.analysisMeta.trackingFrameWidthPx, result.barPathSeries, result.repSegments]);

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
        {historyOverlaySegments.length > 0 ? (
          <View testID="video-analysis-background-path" pointerEvents="none" style={styles.historyOverlayLayer}>
            {historyOverlaySegments.map((segment) => (
              <View
                key={segment.key}
                style={[
                  styles.backgroundPathSegment,
                  themedStyles.backgroundRepPathSegment,
                  {
                    left: segment.centerX - segment.width / 2,
                    top: segment.centerY - PATH_SEGMENT_THICKNESS / 2,
                    width: segment.width,
                    transform: [{rotateZ: `${segment.angleRad}rad`}],
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
        {activeRepOverlaySegments.length > 0 ? (
          <View testID="video-analysis-playback-active-rep-path" pointerEvents="none" style={styles.historyOverlayLayer}>
            {activeRepOverlaySegments.map((segment) => (
              <View
                key={segment.key}
                style={[
                  styles.pathSegment,
                  themedStyles.activeRepPathSegment,
                  {
                    left: segment.centerX - segment.width / 2,
                    top: segment.centerY - PATH_SEGMENT_THICKNESS / 2,
                    width: segment.width,
                    transform: [{rotateZ: `${segment.angleRad}rad`}],
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.timePlotSection}>
        <View style={styles.timePlotHeader}>
          <View style={styles.timePlotHeaderTopRow}>
            <Text variant="labelMedium">Bar Y Position Over Time</Text>
            <Text variant="bodySmall">
              t={formatDuration(playbackTimeMs)} | y={currentBarPathPoint ? Math.round(currentBarPathPoint.y) : '-'}
            </Text>
          </View>
        </View>
        <View testID="video-analysis-playback-time-plot" style={[styles.timePlotContainer, themedStyles.timePlotBackground]} onLayout={onTimePlotLayout}>
          {timePlotPoints.map((point) => (
            <View
              key={point.key}
              style={[
                styles.timePlotPoint,
                themedStyles.timePlotPoint,
                {
                  left: point.x - 1.5,
                  top: point.y - 1.5,
                },
              ]}
            />
          ))}
          {currentTimePlotMarker ? (
            <>
              <View pointerEvents="none" style={[styles.timePlotMarkerLine, themedStyles.timePlotMarkerLine, {left: currentTimePlotMarker.x}]} />
              <View
                pointerEvents="none"
                style={[
                  styles.timePlotMarker,
                  themedStyles.timePlotMarker,
                  {
                    left: currentTimePlotMarker.x - 4,
                    top: currentTimePlotMarker.y - 4,
                  },
                ]}
              />
            </>
          ) : null}
        </View>
        <View style={styles.timePlotAxisRow}>
          <Text variant="bodySmall">0:00</Text>
          <Text variant="bodySmall">{formatDuration(correctedPlaybackDurationMs)}</Text>
        </View>
      </View>

      <View style={styles.speedPlotSection}>
        <View style={styles.timePlotHeaderTopRow}>
          <Text variant="labelMedium">Bar v_y Over Time</Text>
          <Text testID="video-analysis-playback-speed" variant="bodySmall" style={styles.timePlotSpeedText}>
            v_y={currentBarVerticalVelocityPxPerSecond !== undefined ? Math.round(currentBarVerticalVelocityPxPerSecond) : '-'} px/s
          </Text>
        </View>
        <LineChart
          testID="video-analysis-playback-speed-plot"
          style={[styles.speedPlotContainer, themedStyles.speedPlotBackground]}
          onSelect={onSpeedChartSelect}
          data={{
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
              {
                values: progressVelocityLineValues,
                config: {
                  color: speedChartColors.progressLine,
                  drawCircles: false,
                  drawValues: false,
                  lineWidth: 1.5,
                  mode: 'LINEAR',
                  highlightEnabled: false,
                },
              },
            ],
          }}
          legend={{enabled: false}}
          chartDescription={{text: ''}}
          marker={{enabled: false}}
          xAxis={{
            enabled: false,
            drawGridLines: false,
            drawAxisLine: false,
          }}
          yAxis={{
            left: {
              axisMinimum: -verticalVelocityAxisLimit,
              axisMaximum: verticalVelocityAxisLimit,
              textColor: speedChartColors.text,
              gridColor: speedChartColors.grid,
              axisLineColor: speedChartColors.axis,
            },
            right: {
              enabled: false,
            },
          }}
        />
        <View style={styles.timePlotAxisRow}>
          <Text variant="bodySmall">down (-)</Text>
          <Text variant="bodySmall">{currentBarVerticalVelocityPxPerSecond !== undefined ? `${Math.round(currentBarVerticalVelocityPxPerSecond)} px/s` : '-'}</Text>
          <Text variant="bodySmall">up (+)</Text>
        </View>
        <View style={styles.timePlotAxisRow}>
          <Text variant="bodySmall">t=0:00</Text>
          <Text variant="bodySmall">{formatDuration(correctedPlaybackDurationMs)}</Text>
        </View>
      </View>

      {repSegments.length > 0 ? (
        <View testID="video-analysis-rep-metrics" style={styles.repMetricsSection}>
          <Text variant="labelMedium">Detected Reps: {repSegments.length}</Text>
          {repSegments.map((seg) => (
            <Text key={seg.repIndex} variant="bodySmall">
              Rep {seg.repIndex + 1}: {formatDuration(seg.endMs - seg.startMs)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.playbackControls}>
        <Button testID="video-analysis-playback-toggle" mode="outlined" onPress={() => setPlaybackPaused((paused) => !paused)}>
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
          <View testID="video-analysis-playback-scrubber-fill" style={[styles.scrubberFill, themedStyles.scrubberFill, {width: `${scrubberProgress * 100}%`}]} />
          <View testID="video-analysis-playback-scrubber-thumb" style={[styles.scrubberThumb, themedStyles.scrubberThumb, {left: `${scrubberProgress * 100}%`}]} />
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
  pathSegment: {
    position: 'absolute',
    height: PATH_SEGMENT_THICKNESS,
    borderRadius: PATH_SEGMENT_THICKNESS / 2,
    opacity: 0.92,
  },
  backgroundPathSegment: {
    position: 'absolute',
    height: PATH_SEGMENT_THICKNESS,
    borderRadius: PATH_SEGMENT_THICKNESS / 2,
    opacity: 0.22,
  },
  overlayHint: {
    marginBottom: 10,
  },
  playbackControls: {
    marginTop: 10,
  },
  timePlotSection: {
    marginTop: 12,
  },
  timePlotHeader: {
    marginBottom: 8,
    gap: 4,
  },
  timePlotHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timePlotSpeedText: {
    marginTop: 2,
  },
  timePlotContainer: {
    position: 'relative',
    height: TIME_PLOT_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timePlotPoint: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.5,
  },
  timePlotMarkerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.45,
  },
  timePlotMarker: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timePlotAxisRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  speedPlotSection: {
    marginTop: 12,
  },
  speedPlotContainer: {
    position: 'relative',
    height: SPEED_PLOT_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
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
  repMetricsSection: {
    marginTop: 12,
    gap: 2,
  },
});

export default memo(VideoAnalysisPlaybackOverlayCard);
