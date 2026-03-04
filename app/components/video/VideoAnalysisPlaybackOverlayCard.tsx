import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
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

const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;

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
  const activeSegment = segments.find((segment) => timeMs >= segment.startMs && timeMs <= segment.endMs);
  return activeSegment?.repIndex;
};

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    previewBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
  });

const VideoAnalysisPlaybackOverlayCard = ({localVideoPath, result}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [playbackAspectRatio, setPlaybackAspectRatio] = useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [currentRepIndex, setCurrentRepIndex] = useState<number | undefined>();

  const playbackDurationRef = useRef(0);
  const latestProgressTimeRef = useRef(0);
  const currentRepIndexRef = useRef<number | undefined>(undefined);

  const repSegments = result.repSegments;
  const timeRange = useMemo(() => getTimeRange(result.barPathSeries), [result.barPathSeries]);

  const correctedPlaybackDurationMs = useMemo(() => {
    if (playbackDurationMs > 0) {
      return playbackDurationMs;
    }
    return timeRange.durationMs;
  }, [playbackDurationMs, timeRange.durationMs]);

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

  const onPlayerLoad = useCallback(
    (event: {nativeEvent?: VideoPlayerLoadEvent}) => {
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
        setPlaybackAspectRatio(videoWidth / videoHeight);
      }
    },
    [],
  );

  const onPlayerProgress = useCallback(
    (event: {nativeEvent?: VideoPlayerProgressEvent}) => {
      const nativeEvent = event.nativeEvent;
      if (!nativeEvent) {
        return;
      }

      const currentTimeMs = nativeEvent.currentTimeMs;
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

      setPlaybackTimeMs((previousMs) => {
        if (previousMs === currentTimeMs) {
          return previousMs;
        }
        return currentTimeMs;
      });

      updateCurrentRepForPlaybackTime(currentTimeMs);
    },
    [updateCurrentRepForPlaybackTime],
  );

  const onPlayerEnd = useCallback(() => {
    setPlaybackPaused(true);
    const finalTimeMs = Math.max(playbackDurationRef.current, latestProgressTimeRef.current);
    setPlaybackTimeMs(finalTimeMs);
    updateCurrentRepForPlaybackTime(finalTimeMs);
  }, [updateCurrentRepForPlaybackTime]);

  useEffect(() => {
    setPlaybackPaused(true);
    setPlaybackTimeMs(0);
    setPlaybackDurationMs(0);
    setPlaybackAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
    setCurrentRepIndex(undefined);
    playbackDurationRef.current = 0;
    latestProgressTimeRef.current = 0;
    currentRepIndexRef.current = undefined;
  }, [localVideoPath, result.analysisMeta.trackingFrameHeightPx, result.analysisMeta.trackingFrameWidthPx, result.barPathSeries, result.repSegments]);

  return (
    <>
      <Text style={styles.overlayHint}>Live playback with current detected bar position.</Text>
      <View
        testID="video-analysis-playback-overlay"
        style={[styles.previewContainer, themedStyles.previewBackground, {aspectRatio: playbackAspectRatio}]}
      >
        <VideoAnalysisPlayerView
          testID="video-analysis-playback-player"
          style={styles.previewImage}
          source={localVideoPath}
          paused={playbackPaused}
          barPathSeries={result.barPathSeries}
          trackingFrameWidthPx={result.analysisMeta.trackingFrameWidthPx}
          trackingFrameHeightPx={result.analysisMeta.trackingFrameHeightPx}
          onLoad={onPlayerLoad}
          onProgress={onPlayerProgress}
          onEnd={onPlayerEnd}
        />
      </View>

      <View style={styles.playbackControls}>
        <Button testID="video-analysis-playback-toggle" mode="outlined" onPress={() => setPlaybackPaused((paused) => !paused)}>
          {playbackPaused ? 'Play' : 'Pause'}
        </Button>
        <Text testID="video-analysis-playback-time">
          Playback: {formatDuration(playbackTimeMs)} / {formatDuration(correctedPlaybackDurationMs)}
        </Text>
        <Text>{currentRepIndex !== undefined ? `Current Rep: ${currentRepIndex}` : 'Current Rep: -'}</Text>
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
  overlayHint: {
    marginBottom: 10,
  },
  playbackControls: {
    marginTop: 10,
  },
});

export default memo(VideoAnalysisPlaybackOverlayCard);
