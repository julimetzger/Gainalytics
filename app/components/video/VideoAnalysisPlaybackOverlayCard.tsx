import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {Button, MD3Theme, Text, useTheme} from 'react-native-paper';
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

interface TimePlotPoint {
  key: string;
  x: number;
  y: number;
}

const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;
const TIME_PLOT_HEIGHT = 112;

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

  const sourceWidth = videoWidth > 0 ? videoWidth : trackingFrameWidthPx ?? overlayWidth;
  const sourceHeight = videoHeight > 0 ? videoHeight : trackingFrameHeightPx ?? overlayHeight;
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

const findNearestBarPathPoint = (barPathSeries: BarPathPoint[], timeMs: number): BarPathPoint | undefined => {
  if (barPathSeries.length === 0) {
    return undefined;
  }

  let nearestPoint = barPathSeries[0];
  let nearestDistance = Math.abs(timeMs - nearestPoint.tMs);

  for (let index = 1; index < barPathSeries.length; index += 1) {
    const point = barPathSeries[index];
    const distance = Math.abs(timeMs - point.tMs);
    if (distance < nearestDistance) {
      nearestPoint = point;
      nearestDistance = distance;
    }
  }

  return nearestPoint;
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
  });

const VideoAnalysisPlaybackOverlayCard = ({localVideoPath, result}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [playbackAspectRatio, setPlaybackAspectRatio] = useState(DEFAULT_PREVIEW_ASPECT_RATIO);
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
  const lastRenderedPlaybackSecondRef = useRef(-1);
  const currentRepIndexRef = useRef<number | undefined>(undefined);
  const pendingSeekTargetMsRef = useRef<number | undefined>(undefined);
  const pendingSeekDeadlineMsRef = useRef(0);

  const repSegments = result.repSegments;
  const timeRange = useMemo(() => getTimeRange(result.barPathSeries), [result.barPathSeries]);
  const correctedPlaybackDurationMs = useMemo(() => {
    if (playbackDurationMs > 0) {
      return playbackDurationMs;
    }
    return timeRange.durationMs;
  }, [playbackDurationMs, timeRange.durationMs]);
  const historyOverlayPoints = useMemo(
    () =>
      mapBarPathToOverlay(
        result.barPathSeries,
        overlayWidth,
        overlayHeight,
        playbackVideoWidth,
        playbackVideoHeight,
        result.analysisMeta.trackingFrameWidthPx,
        result.analysisMeta.trackingFrameHeightPx,
      ),
    [overlayHeight, overlayWidth, playbackVideoHeight, playbackVideoWidth, result.analysisMeta.trackingFrameHeightPx, result.analysisMeta.trackingFrameWidthPx, result.barPathSeries],
  );
  const scrubberProgress = correctedPlaybackDurationMs > 0 ? clamp(playbackTimeMs / correctedPlaybackDurationMs, 0, 1) : 0;
  const timePlotPoints = useMemo(
    () => mapBarPathToTimePlot(result.barPathSeries, timePlotWidth, TIME_PLOT_HEIGHT, result.analysisMeta.trackingFrameHeightPx),
    [result.analysisMeta.trackingFrameHeightPx, result.barPathSeries, timePlotWidth],
  );
  const currentBarPathPoint = useMemo(() => findNearestBarPathPoint(result.barPathSeries, playbackTimeMs), [playbackTimeMs, result.barPathSeries]);
  const currentTimePlotMarker = useMemo(() => {
    if (timePlotWidth <= 0 || !currentBarPathPoint) {
      return undefined;
    }

    const timeX = correctedPlaybackDurationMs > 0 ? clamp(playbackTimeMs / correctedPlaybackDurationMs, 0, 1) * timePlotWidth : 0;
    const maxY =
      result.analysisMeta.trackingFrameHeightPx && result.analysisMeta.trackingFrameHeightPx > 0
        ? result.analysisMeta.trackingFrameHeightPx
        : Math.max(1, ...result.barPathSeries.map((point) => point.y));
    const markerY = clamp(currentBarPathPoint.y / Math.max(1, maxY), 0, 1) * TIME_PLOT_HEIGHT;

    return {
      x: timeX,
      y: markerY,
    };
  }, [correctedPlaybackDurationMs, currentBarPathPoint, playbackTimeMs, result.analysisMeta.trackingFrameHeightPx, result.barPathSeries, timePlotWidth]);

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

    const nextSecondBucket = Math.floor(clampedTimeMs / 1000);
    if (!force && nextSecondBucket === lastRenderedPlaybackSecondRef.current) {
      return false;
    }

    lastRenderedPlaybackSecondRef.current = nextSecondBucket;
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
      setPlaybackAspectRatio(videoWidth / videoHeight);
    }
  }, []);

  const onPlayerProgress = useCallback(
    (event: {nativeEvent?: VideoPlayerProgressEvent}) => {
      const nativeEvent = event.nativeEvent;
      if (!nativeEvent) {
        return;
      }

      const currentTimeMs = nativeEvent.currentTimeMs;
      const nowMs = Date.now();
      const pendingSeekTargetMs = pendingSeekTargetMsRef.current;
      if (pendingSeekTargetMs !== undefined && nowMs < pendingSeekDeadlineMsRef.current) {
        if (Math.abs(currentTimeMs - pendingSeekTargetMs) > 1500) {
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
      pendingSeekDeadlineMsRef.current = Date.now() + 2000;
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
    setPlaybackAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
    setPlaybackVideoWidth(0);
    setPlaybackVideoHeight(0);
    setCurrentRepIndex(undefined);
    setSeekPositionMs(undefined);
    playbackDurationRef.current = 0;
    latestProgressTimeRef.current = 0;
    playbackTimeRef.current = 0;
    lastRenderedPlaybackSecondRef.current = -1;
    currentRepIndexRef.current = undefined;
    pendingSeekTargetMsRef.current = undefined;
    pendingSeekDeadlineMsRef.current = 0;
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
          barPathSeries={result.barPathSeries}
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

      <View style={styles.timePlotSection}>
        <View style={styles.timePlotHeader}>
          <Text variant="labelMedium">Bar Y Position Over Time</Text>
          <Text variant="bodySmall">
            t={formatDuration(playbackTimeMs)} | y={currentBarPathPoint ? Math.round(currentBarPathPoint.y) : '-'}
          </Text>
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
          onResponderGrant={(event) => onScrubberTouch(event.nativeEvent.locationX, scrubberWidth)}
          onResponderMove={(event) => onScrubberTouch(event.nativeEvent.locationX, scrubberWidth)}>
          <View style={[styles.scrubberFill, themedStyles.scrubberFill, {width: `${scrubberProgress * 100}%`}]} />
          <View style={[styles.scrubberThumb, themedStyles.scrubberThumb, {left: `${scrubberProgress * 100}%`}]} />
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
  timePlotSection: {
    marginTop: 12,
  },
  timePlotHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
});

export default memo(VideoAnalysisPlaybackOverlayCard);
