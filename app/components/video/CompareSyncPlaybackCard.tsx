import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, TouchableOpacity, View, processColor} from 'react-native';
import Animated, {useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, SharedValue} from 'react-native-reanimated';
import {IconButton, MD3Theme, Text, useTheme} from 'react-native-paper';
import {BarTrackingResult} from '../../models/entities/VideoAnalysis';
import VideoAnalysisPlayerView, {VideoPlayerLoadEvent, VideoPlayerProgressEvent} from './VideoAnalysisPlayerView';
import {
  clampMs,
  computeRepTickFractions,
  computeTimelineDurationMs,
  findNextRepStartMs,
  findPrevRepStartMs,
  formatOffsetLabel,
  formatRepSyncSubtitle,
  formatSpeedLabel,
  formatTimelineTime,
  mapTimelineToVideoTimes,
} from '../../utils/compareSync';

export type CompareSyncMode = 'auto' | 'manual';

export interface CompareSyncPlaybackHandle {
  /** Move the shared timeline; both videos seek to their mapped positions. */
  seekToTimelineMs: (timelineMs: number) => void;
}

interface Props {
  videoPathA: string;
  videoPathB: string;
  resultA: BarTrackingResult;
  resultB: BarTrackingResult;
  /** Effective B offset (auto-aligned or manual), owned by the parent. */
  offsetBMs: number;
  autoOffsetMs: number;
  syncMode: CompareSyncMode;
  onSyncModeChange: (mode: CompareSyncMode) => void;
  onManualOffsetChange: (offsetMs: number) => void;
  /** Shared timeline position in ms, written on the UI thread for smooth scrubber/marker motion. */
  timelineTimeSV: SharedValue<number>;
  onTimelineDurationChange?: (durationMs: number) => void;
  onCurrentRepChange?: (repIndex: number | undefined) => void;
}

const DEFAULT_ASPECT_RATIO = 9 / 16;
const FRAME_STEP_MS = 50;
// B is re-seeked when its reported position drifts further than this from the
// timeline-mapped position while playing.
const DRIFT_TOLERANCE_MS = 150;
const DRIFT_CORRECTION_COOLDOWN_MS = 700;
const SEEK_COOLDOWN_MS = 400;
const DISPLAY_TIME_THROTTLE_MS = 150;
// Manual offset regulator range around the auto alignment.
const MANUAL_OFFSET_RANGE_MS = 2000;
const MANUAL_OFFSET_STEP_MS = 50;
const SPEED_OPTIONS = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0] as const;

const lastSeriesTimeMs = (result: BarTrackingResult): number => {
  const series = result.barPathSeries;
  return series.length > 0 ? series[series.length - 1].tMs : 0;
};

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    videoContainerA: {
      borderColor: theme.colors.primary,
    },
    videoContainerB: {
      borderColor: theme.colors.tertiary,
    },
    videoCornerLabelA: {
      backgroundColor: theme.colors.primary,
      color: theme.colors.onPrimary,
    },
    videoCornerLabelB: {
      backgroundColor: theme.colors.tertiary,
      color: theme.colors.onTertiary,
    },
    videoTimeBadge: {
      backgroundColor: theme.colors.backdrop,
      color: theme.colors.onSurface,
    },
    repSyncCard: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    segmentedContainer: {
      backgroundColor: theme.colors.surface,
    },
    segmentedActive: {
      backgroundColor: theme.colors.primary,
    },
    segmentedActiveText: {
      color: theme.colors.onPrimary,
    },
    segmentedInactiveText: {
      color: theme.colors.onSurfaceVariant,
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
    repTick: {
      backgroundColor: theme.colors.onSurfaceVariant,
    },
    offsetTrack: {
      backgroundColor: theme.colors.surface,
    },
    offsetThumb: {
      backgroundColor: theme.colors.tertiary,
    },
    timeLabel: {
      color: theme.colors.onSurfaceVariant,
    },
  });

const CompareSyncPlaybackCard = forwardRef<CompareSyncPlaybackHandle, Props>((props, ref) => {
  const {
    videoPathA,
    videoPathB,
    resultA,
    resultB,
    offsetBMs,
    autoOffsetMs,
    syncMode,
    onSyncModeChange,
    onManualOffsetChange,
    timelineTimeSV,
    onTimelineDurationChange,
    onCurrentRepChange,
  } = props;
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const overlayColors = useMemo(
    () => ({
      primary: (processColor(theme.colors.primary) ?? undefined) as number | undefined,
      tertiary: (processColor(theme.colors.tertiary) ?? undefined) as number | undefined,
      path: (processColor(theme.colors.outline) ?? undefined) as number | undefined,
    }),
    [theme],
  );

  const [paused, setPaused] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [displayTimeMs, setDisplayTimeMs] = useState(0);
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [offsetTrackWidth, setOffsetTrackWidth] = useState(0);
  const [seekAMs, setSeekAMs] = useState<number | undefined>(undefined);
  const [seekBMs, setSeekBMs] = useState<number | undefined>(undefined);
  const [loadedDurationAMs, setLoadedDurationAMs] = useState(0);
  const [loadedDurationBMs, setLoadedDurationBMs] = useState(0);
  const [aspectRatioA, setAspectRatioA] = useState(DEFAULT_ASPECT_RATIO);
  const [aspectRatioB, setAspectRatioB] = useState(DEFAULT_ASPECT_RATIO);
  const [currentRepIndex, setCurrentRepIndex] = useState<number | undefined>(undefined);

  // Until onLoad reports the real duration, the bar-path series bounds the timeline.
  const durationAMs = Math.max(loadedDurationAMs, lastSeriesTimeMs(resultA));
  const durationBMs = Math.max(loadedDurationBMs, lastSeriesTimeMs(resultB));
  const timelineDurationMs = computeTimelineDurationMs(durationAMs, durationBMs, offsetBMs);

  // useRef wrapper keeps the SharedValue objects stable across renders (the
  // Reanimated jest mock returns a fresh object per useSharedValue call).
  const timelineDurationMsSV = useRef(useSharedValue(0)).current;
  const scrubberWidthSV = useRef(useSharedValue(0)).current;
  const pausedSV = useRef(useSharedValue(true)).current;
  const isScrubbingSV = useRef(useSharedValue(false)).current;
  const playbackSpeedSV = useRef(useSharedValue(1)).current;
  // Marker interpolation anchor: timeline = anchor + (now − anchorRecvAt) × speed.
  // Player A's progress events re-anchor it, so the shared timeline tracks the
  // native master player instead of free-running on wall-clock time.
  const anchorTimeMsSV = useRef(useSharedValue(0)).current;
  const anchorRecvAtMsSV = useRef(useSharedValue(0)).current;
  const uiNowMsSV = useRef(useSharedValue(0)).current;

  const timelineTimeRef = useRef(0);
  const displayTimeRef = useRef(0);
  const pausedRef = useRef(true);
  const playbackSpeedRef = useRef(1.0);
  const isScrubbingRef = useRef(false);
  const offsetBRef = useRef(offsetBMs);
  const durationARef = useRef(durationAMs);
  const durationBRef = useRef(durationBMs);
  const timelineDurationRef = useRef(timelineDurationMs);
  const currentRepIndexRef = useRef<number | undefined>(undefined);
  const seekCooldownUntilRef = useRef(0);
  const driftCooldownUntilRef = useRef(0);
  const lastBTimeMsRef = useRef(0);
  const lastBTimeAtRef = useRef(0);
  const loadedARef = useRef(false);
  const loadedBRef = useRef(false);
  const initialAlignedRef = useRef(false);

  durationARef.current = durationAMs;
  durationBRef.current = durationBMs;
  timelineDurationRef.current = timelineDurationMs;

  const repSegmentsA = resultA.repSegments;
  const repTickFractions = useMemo(
    () => computeRepTickFractions(repSegmentsA, timelineDurationMs),
    [repSegmentsA, timelineDurationMs],
  );

  useEffect(() => {
    timelineDurationMsSV.value = timelineDurationMs; // eslint-disable-line react-hooks/exhaustive-deps
    onTimelineDurationChange?.(timelineDurationMs);
  }, [timelineDurationMs, onTimelineDurationChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCurrentRepForTime = useCallback(
    (timelineMs: number) => {
      let nextRepIndex: number | undefined;
      for (const segment of repSegmentsA) {
        if (timelineMs >= segment.startMs && timelineMs <= segment.endMs) {
          nextRepIndex = segment.repIndex;
          break;
        }
      }
      if (nextRepIndex !== currentRepIndexRef.current) {
        currentRepIndexRef.current = nextRepIndex;
        setCurrentRepIndex(nextRepIndex);
        onCurrentRepChange?.(nextRepIndex);
      }
    },
    [repSegmentsA, onCurrentRepChange],
  );

  // Advances the shared timeline on the UI thread between player progress events.
  useFrameCallback((frameInfo) => {
    'worklet';
    uiNowMsSV.value = frameInfo.timestamp;
    if (pausedSV.value || isScrubbingSV.value) {
      return;
    }
    const total = timelineDurationMsSV.value;
    if (total <= 0 || anchorRecvAtMsSV.value <= 0) {
      return;
    }
    const target = anchorTimeMsSV.value + (frameInfo.timestamp - anchorRecvAtMsSV.value) * playbackSpeedSV.value;
    timelineTimeSV.value = target > total ? total : target < 0 ? 0 : target;
  });

  // Mirror speed into the UI thread and re-anchor so the timeline stays continuous.
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    playbackSpeedSV.value = playbackSpeed; // eslint-disable-line react-hooks/exhaustive-deps
    anchorTimeMsSV.value = timelineTimeSV.value; // eslint-disable-line react-hooks/exhaustive-deps
    anchorRecvAtMsSV.value = uiNowMsSV.value; // eslint-disable-line react-hooks/exhaustive-deps
  }, [playbackSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDisplayTimeThrottled = useCallback((timelineMs: number, force: boolean) => {
    if (force || Math.abs(timelineMs - displayTimeRef.current) >= DISPLAY_TIME_THROTTLE_MS) {
      displayTimeRef.current = timelineMs;
      setDisplayTimeMs(timelineMs);
    }
  }, []);

  const applyTimelineSeek = useCallback(
    (nextTimelineMs: number) => {
      const timelineMs = clampMs(Math.round(nextTimelineMs), 0, timelineDurationRef.current);
      timelineTimeSV.value = timelineMs; // eslint-disable-line react-hooks/exhaustive-deps
      timelineTimeRef.current = timelineMs;
      setDisplayTimeThrottled(timelineMs, true);
      updateCurrentRepForTime(timelineMs);
      const mapped = mapTimelineToVideoTimes(timelineMs, offsetBRef.current, durationARef.current, durationBRef.current);
      setSeekAMs(Math.round(mapped.aMs));
      setSeekBMs(Math.round(mapped.bMs));
      anchorTimeMsSV.value = timelineMs; // eslint-disable-line react-hooks/exhaustive-deps
      anchorRecvAtMsSV.value = uiNowMsSV.value; // eslint-disable-line react-hooks/exhaustive-deps
      // Ignore stale progress events until the players caught up with the seek.
      seekCooldownUntilRef.current = Date.now() + SEEK_COOLDOWN_MS;
    },
    [setDisplayTimeThrottled, updateCurrentRepForTime], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useImperativeHandle(ref, () => ({seekToTimelineMs: applyTimelineSeek}), [applyTimelineSeek]);

  // When the offset changes (manual regulator or mode switch), re-align B to the
  // current timeline position immediately so the shift is visible and persistent.
  useEffect(() => {
    offsetBRef.current = offsetBMs;
    if (initialAlignedRef.current) {
      const mapped = mapTimelineToVideoTimes(timelineTimeRef.current, offsetBMs, durationARef.current, durationBRef.current);
      setSeekBMs(Math.round(mapped.bMs));
      driftCooldownUntilRef.current = Date.now() + DRIFT_CORRECTION_COOLDOWN_MS;
    }
  }, [offsetBMs]);

  const maybeAlignInitially = useCallback(() => {
    if (initialAlignedRef.current || !loadedARef.current || !loadedBRef.current) {
      return;
    }
    initialAlignedRef.current = true;
    // Start both videos aligned on rep 1 lift-off.
    applyTimelineSeek(repSegmentsA[0]?.startMs ?? 0);
  }, [applyTimelineSeek, repSegmentsA]);

  const onLoadA = useCallback(
    (event: {nativeEvent: VideoPlayerLoadEvent}) => {
      const {durationMs, videoWidth, videoHeight} = event.nativeEvent;
      setLoadedDurationAMs((prev) => Math.max(prev, durationMs));
      if (videoWidth > 0 && videoHeight > 0) {
        setAspectRatioA(videoWidth / videoHeight);
      }
      loadedARef.current = true;
      maybeAlignInitially();
    },
    [maybeAlignInitially],
  );

  const onLoadB = useCallback(
    (event: {nativeEvent: VideoPlayerLoadEvent}) => {
      const {durationMs, videoWidth, videoHeight} = event.nativeEvent;
      setLoadedDurationBMs((prev) => Math.max(prev, durationMs));
      if (videoWidth > 0 && videoHeight > 0) {
        setAspectRatioB(videoWidth / videoHeight);
      }
      loadedBRef.current = true;
      maybeAlignInitially();
    },
    [maybeAlignInitially],
  );

  // Player A is the master clock: its progress events re-anchor the shared
  // timeline and trigger drift-correction seeks on player B.
  const onProgressA = useCallback(
    (event: {nativeEvent?: VideoPlayerProgressEvent}) => {
      const nativeEvent = event.nativeEvent;
      if (!nativeEvent) {
        return;
      }
      if (nativeEvent.durationMs > 0) {
        setLoadedDurationAMs((prev) => Math.max(prev, nativeEvent.durationMs));
      }
      const timelineMs = nativeEvent.currentTimeMs;
      updateCurrentRepForTime(timelineMs);
      if (pausedRef.current || isScrubbingRef.current || Date.now() < seekCooldownUntilRef.current) {
        return;
      }
      anchorTimeMsSV.value = timelineMs; // eslint-disable-line react-hooks/exhaustive-deps
      anchorRecvAtMsSV.value = uiNowMsSV.value; // eslint-disable-line react-hooks/exhaustive-deps
      timelineTimeRef.current = timelineMs;
      setDisplayTimeThrottled(timelineMs, false);

      // Drift correction: keep B locked to timeline + offset while playing.
      const expectedBMs = timelineMs + offsetBRef.current;
      if (expectedBMs >= 0 && expectedBMs <= durationBRef.current && lastBTimeAtRef.current > 0) {
        const estimatedBMs = lastBTimeMsRef.current + (Date.now() - lastBTimeAtRef.current) * playbackSpeedRef.current;
        if (Math.abs(estimatedBMs - expectedBMs) > DRIFT_TOLERANCE_MS && Date.now() > driftCooldownUntilRef.current) {
          setSeekBMs(Math.round(expectedBMs));
          driftCooldownUntilRef.current = Date.now() + DRIFT_CORRECTION_COOLDOWN_MS;
        }
      }
    },
    [setDisplayTimeThrottled, updateCurrentRepForTime], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onProgressB = useCallback((event: {nativeEvent?: VideoPlayerProgressEvent}) => {
    const nativeEvent = event.nativeEvent;
    if (!nativeEvent) {
      return;
    }
    if (nativeEvent.durationMs > 0) {
      setLoadedDurationBMs((prev) => Math.max(prev, nativeEvent.durationMs));
    }
    lastBTimeMsRef.current = nativeEvent.currentTimeMs;
    lastBTimeAtRef.current = Date.now();
  }, []);

  const pausePlayback = useCallback(
    (snapTimelineMs?: number) => {
      pausedRef.current = true;
      pausedSV.value = true; // eslint-disable-line react-hooks/exhaustive-deps
      setPaused(true);
      const timelineMs = snapTimelineMs ?? Math.round(timelineTimeSV.value); // eslint-disable-line react-hooks/exhaustive-deps
      timelineTimeRef.current = timelineMs;
      timelineTimeSV.value = timelineMs; // eslint-disable-line react-hooks/exhaustive-deps
      setDisplayTimeThrottled(timelineMs, true);
      updateCurrentRepForTime(timelineMs);
    },
    [setDisplayTimeThrottled, updateCurrentRepForTime], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The video whose mapped end defines the timeline end stops the shared playback.
  const onEndA = useCallback(() => {
    if (durationARef.current >= timelineDurationRef.current - 80) {
      pausePlayback(timelineDurationRef.current);
    }
  }, [pausePlayback]);

  const onEndB = useCallback(() => {
    if (durationBRef.current - offsetBRef.current >= timelineDurationRef.current - 80) {
      pausePlayback(timelineDurationRef.current);
    }
  }, [pausePlayback]);

  const onPlayPauseToggle = useCallback(() => {
    if (!pausedRef.current) {
      pausePlayback();
      return;
    }
    // Restart from the beginning when play is hit at the timeline end.
    if (timelineTimeRef.current >= timelineDurationRef.current - 80) {
      applyTimelineSeek(0);
    }
    pausedRef.current = false;
    pausedSV.value = false; // eslint-disable-line react-hooks/exhaustive-deps
    setPaused(false);
    anchorTimeMsSV.value = timelineTimeRef.current; // eslint-disable-line react-hooks/exhaustive-deps
    anchorRecvAtMsSV.value = uiNowMsSV.value; // eslint-disable-line react-hooks/exhaustive-deps
  }, [applyTimelineSeek, pausePlayback]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPrevRep = useCallback(() => {
    const prevStartMs = findPrevRepStartMs(repSegmentsA, timelineTimeRef.current);
    applyTimelineSeek(prevStartMs ?? 0);
  }, [applyTimelineSeek, repSegmentsA]);

  const onNextRep = useCallback(() => {
    const nextStartMs = findNextRepStartMs(repSegmentsA, timelineTimeRef.current);
    if (nextStartMs !== null) {
      applyTimelineSeek(nextStartMs);
    }
  }, [applyTimelineSeek, repSegmentsA]);

  const onStepBack = useCallback(() => applyTimelineSeek(timelineTimeRef.current - FRAME_STEP_MS), [applyTimelineSeek]);
  const onStepForward = useCallback(() => applyTimelineSeek(timelineTimeRef.current + FRAME_STEP_MS), [applyTimelineSeek]);

  const onScrubberLayout = useCallback((event: LayoutChangeEvent) => {
    const {width} = event.nativeEvent.layout;
    setScrubberWidth(width);
    scrubberWidthSV.value = width; // eslint-disable-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrubberTouch = useCallback(
    (locationX: number) => {
      if (scrubberWidth <= 0 || timelineDurationRef.current <= 0) {
        return;
      }
      const progress = clampMs(locationX / scrubberWidth, 0, 1);
      applyTimelineSeek(progress * timelineDurationRef.current);
    },
    [applyTimelineSeek, scrubberWidth],
  );

  const scrubberProgressPx = useDerivedValue(() => {
    'worklet';
    if (timelineDurationMsSV.value <= 0 || scrubberWidthSV.value <= 0) {
      return 0;
    }
    const progress = Math.min(1, Math.max(0, timelineTimeSV.value / timelineDurationMsSV.value));
    return progress * scrubberWidthSV.value;
  });

  const scrubberFillStyle = useAnimatedStyle(() => {
    'worklet';
    return {width: scrubberProgressPx.value};
  });

  const scrubberThumbStyle = useAnimatedStyle(() => {
    'worklet';
    return {transform: [{translateX: scrubberProgressPx.value}]};
  });

  const onOffsetTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setOffsetTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const onOffsetTrackTouch = useCallback(
    (locationX: number) => {
      if (offsetTrackWidth <= 0) {
        return;
      }
      const fraction = clampMs(locationX / offsetTrackWidth, 0, 1);
      const nextOffset = Math.round((autoOffsetMs - MANUAL_OFFSET_RANGE_MS + fraction * 2 * MANUAL_OFFSET_RANGE_MS) / 10) * 10;
      onManualOffsetChange(nextOffset);
    },
    [autoOffsetMs, offsetTrackWidth, onManualOffsetChange],
  );

  const stepManualOffset = useCallback(
    (deltaMs: number) => {
      const nextOffset = clampMs(offsetBMs + deltaMs, autoOffsetMs - MANUAL_OFFSET_RANGE_MS, autoOffsetMs + MANUAL_OFFSET_RANGE_MS);
      onManualOffsetChange(nextOffset);
    },
    [autoOffsetMs, offsetBMs, onManualOffsetChange],
  );

  const offsetThumbFraction = clampMs((offsetBMs - autoOffsetMs + MANUAL_OFFSET_RANGE_MS) / (2 * MANUAL_OFFSET_RANGE_MS), 0, 1);

  const mappedDisplayTimes = mapTimelineToVideoTimes(displayTimeMs, offsetBMs, durationAMs, durationBMs);

  return (
    <View testID="compare-sync-card">
      {/* Side-by-side synced players */}
      <View style={styles.videoRow}>
        <View
          testID="compare-video-a"
          style={[styles.videoWrapper, {aspectRatio: aspectRatioA}, themedStyles.videoContainerA]}
        >
          <VideoAnalysisPlayerView
            source={videoPathA}
            paused={paused}
            seekPositionMs={seekAMs}
            playbackSpeed={playbackSpeed}
            barPathSeries={resultA.barPathSeries}
            repSegments={resultA.repSegments}
            currentRepIndex={currentRepIndex}
            primaryColor={overlayColors.primary}
            pathColor={overlayColors.path}
            trackingFrameWidthPx={resultA.analysisMeta.trackingFrameWidthPx}
            trackingFrameHeightPx={resultA.analysisMeta.trackingFrameHeightPx}
            onLoad={onLoadA}
            onProgress={onProgressA}
            onEnd={onEndA}
            style={styles.video}
          />
          <View style={styles.videoBadgeRow} pointerEvents="none">
            <Text style={[styles.videoCornerLabel, themedStyles.videoCornerLabelA]}>A</Text>
            <Text testID="compare-video-a-time" style={[styles.videoTimeBadge, themedStyles.videoTimeBadge]}>
              {formatTimelineTime(mappedDisplayTimes.aMs)}
            </Text>
          </View>
        </View>
        <View
          testID="compare-video-b"
          style={[styles.videoWrapper, {aspectRatio: aspectRatioB}, themedStyles.videoContainerB]}
        >
          <VideoAnalysisPlayerView
            source={videoPathB}
            paused={paused}
            seekPositionMs={seekBMs}
            playbackSpeed={playbackSpeed}
            barPathSeries={resultB.barPathSeries}
            repSegments={resultB.repSegments}
            primaryColor={overlayColors.tertiary}
            pathColor={overlayColors.path}
            trackingFrameWidthPx={resultB.analysisMeta.trackingFrameWidthPx}
            trackingFrameHeightPx={resultB.analysisMeta.trackingFrameHeightPx}
            onLoad={onLoadB}
            onProgress={onProgressB}
            onEnd={onEndB}
            style={styles.video}
          />
          <View style={styles.videoBadgeRow} pointerEvents="none">
            <Text style={[styles.videoCornerLabel, themedStyles.videoCornerLabelB]}>B</Text>
            <Text testID="compare-video-b-time" style={[styles.videoTimeBadge, themedStyles.videoTimeBadge]}>
              {formatTimelineTime(mappedDisplayTimes.bMs)}
            </Text>
          </View>
        </View>
      </View>

      {/* Rep Sync card */}
      <View testID="compare-rep-sync-card" style={[styles.repSyncCard, themedStyles.repSyncCard]}>
        <View style={styles.repSyncHeaderRow}>
          <IconButton icon="sync" size={18} style={styles.repSyncIcon} iconColor={theme.colors.onSurfaceVariant} />
          <Text variant="titleSmall" style={styles.repSyncTitle}>Rep Sync</Text>
          <View style={[styles.segmentedContainer, themedStyles.segmentedContainer]}>
            <TouchableOpacity
              testID="compare-rep-sync-auto"
              style={[styles.segmentedButton, syncMode === 'auto' && themedStyles.segmentedActive]}
              onPress={() => onSyncModeChange('auto')}
            >
              <Text
                variant="labelMedium"
                style={syncMode === 'auto' ? themedStyles.segmentedActiveText : themedStyles.segmentedInactiveText}
              >
                Auto
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="compare-rep-sync-manual"
              style={[styles.segmentedButton, syncMode === 'manual' && themedStyles.segmentedActive]}
              onPress={() => onSyncModeChange('manual')}
            >
              <Text
                variant="labelMedium"
                style={syncMode === 'manual' ? themedStyles.segmentedActiveText : themedStyles.segmentedInactiveText}
              >
                Manual
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.repSyncSubtitleRow}>
          <IconButton icon="check-circle" size={16} style={styles.repSyncIcon} iconColor={theme.colors.primary} />
          <Text testID="compare-rep-sync-subtitle" variant="bodySmall" style={styles.repSyncSubtitle}>
            {syncMode === 'auto'
              ? formatRepSyncSubtitle(autoOffsetMs)
              : `B offset ${formatOffsetLabel(offsetBMs)} vs A`}
          </Text>
        </View>
        {syncMode === 'manual' && (
          <View style={styles.offsetRow}>
            <TouchableOpacity testID="compare-offset-step-left" onPress={() => stepManualOffset(-MANUAL_OFFSET_STEP_MS)}>
              <Text style={[styles.offsetStepText, {color: theme.colors.tertiary}]}>{'‹'}</Text>
            </TouchableOpacity>
            <View
              testID="compare-offset-slider"
              style={[styles.offsetTrack, themedStyles.offsetTrack]}
              onLayout={onOffsetTrackLayout}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(event) => onOffsetTrackTouch(event.nativeEvent.locationX)}
              onResponderMove={(event) => onOffsetTrackTouch(event.nativeEvent.locationX)}
            >
              <View style={[styles.offsetCenterMark, themedStyles.repTick]} />
              <View
                style={[
                  styles.offsetThumb,
                  themedStyles.offsetThumb,
                  {left: offsetThumbFraction * Math.max(0, offsetTrackWidth)},
                ]}
              />
            </View>
            <TouchableOpacity testID="compare-offset-step-right" onPress={() => stepManualOffset(MANUAL_OFFSET_STEP_MS)}>
              <Text style={[styles.offsetStepText, {color: theme.colors.tertiary}]}>{'›'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Transport row — mirrors the Video Analysis Detail play bar */}
      <View style={styles.transportRow}>
        <IconButton testID="compare-prev-rep" icon="rewind" size={26} iconColor={theme.colors.primary} onPress={onPrevRep} style={styles.transportButton} />
        <IconButton testID="compare-step-back" icon="skip-previous" size={26} iconColor={theme.colors.primary} onPress={onStepBack} style={styles.transportButton} />
        <IconButton testID="compare-play-pause-button" icon={paused ? 'play' : 'pause'} size={38} iconColor={theme.colors.primary} onPress={onPlayPauseToggle} style={styles.transportButton} />
        <IconButton testID="compare-step-forward" icon="skip-next" size={26} iconColor={theme.colors.primary} onPress={onStepForward} style={styles.transportButton} />
        <IconButton testID="compare-next-rep" icon="fast-forward" size={26} iconColor={theme.colors.primary} onPress={onNextRep} style={styles.transportButton} />
      </View>

      {/* Shared scrubber with rep ticks */}
      <View
        testID="compare-timeline-scrubber"
        style={[styles.scrubberTrack, themedStyles.scrubberTrack]}
        onLayout={onScrubberLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          isScrubbingRef.current = true;
          isScrubbingSV.value = true;
          onScrubberTouch(event.nativeEvent.locationX);
        }}
        onResponderMove={(event) => onScrubberTouch(event.nativeEvent.locationX)}
        onResponderRelease={() => {
          isScrubbingRef.current = false;
          isScrubbingSV.value = false;
        }}
        onResponderTerminate={() => {
          isScrubbingRef.current = false;
          isScrubbingSV.value = false;
        }}
      >
        {scrubberWidth > 0 &&
          repTickFractions.map((fraction, index) => (
            <View
              key={index}
              style={[styles.repTick, themedStyles.repTick, {left: fraction * scrubberWidth}]}
            />
          ))}
        <Animated.View testID="compare-timeline-scrubber-fill" style={[styles.scrubberFill, themedStyles.scrubberFill, scrubberFillStyle]} />
        <Animated.View testID="compare-timeline-scrubber-thumb" style={[styles.scrubberThumb, themedStyles.scrubberThumb, scrubberThumbStyle]} />
      </View>
      <View style={styles.timeLabelRow}>
        <Text testID="compare-timeline-start" variant="labelSmall" style={themedStyles.timeLabel}>
          {formatTimelineTime(0)}
        </Text>
        <Text testID="compare-timeline-end" variant="labelSmall" style={themedStyles.timeLabel}>
          {formatTimelineTime(timelineDurationMs)}
        </Text>
      </View>

      {/* Speed chips — same row as the Video Analysis Detail screen */}
      <View testID="compare-speed-control" style={styles.speedControlRow}>
        <Text testID="compare-speed-label" variant="labelSmall" style={styles.speedLabel}>
          {'Speed: '}{formatSpeedLabel(playbackSpeed)}{'x'}
        </Text>
        {SPEED_OPTIONS.map((speed) => (
          <TouchableOpacity
            key={speed}
            testID={`compare-speed-btn-${speed}`}
            onPress={() => setPlaybackSpeed(speed)}
            style={[styles.speedButton, playbackSpeed === speed && [styles.speedButtonActive, {borderColor: theme.colors.primary}]]}
          >
            <Text variant="labelSmall" style={[styles.speedButtonText, playbackSpeed === speed && {color: theme.colors.primary}]}>
              {speed === 1.0 ? '1x' : `${speed}x`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  videoRow: {
    flexDirection: 'row',
  },
  videoWrapper: {
    flex: 1,
    margin: 4,
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 160,
    maxHeight: 420,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoBadgeRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoCornerLabel: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  videoTimeBadge: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  repSyncCard: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  repSyncHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repSyncIcon: {
    margin: 0,
  },
  repSyncTitle: {
    flex: 1,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 2,
  },
  segmentedButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  repSyncSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  repSyncSubtitle: {
    flex: 1,
    flexWrap: 'wrap',
  },
  offsetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 8,
  },
  offsetStepText: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 32,
    minWidth: 28,
    textAlign: 'center',
  },
  offsetTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  offsetCenterMark: {
    position: 'absolute',
    left: '50%',
    width: 2,
    top: 0,
    bottom: 0,
  },
  offsetThumb: {
    position: 'absolute',
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 8,
  },
  transportButton: {
    margin: 0,
  },
  scrubberTrack: {
    position: 'relative',
    height: 14,
    borderRadius: 999,
    marginTop: 6,
    overflow: 'visible',
  },
  repTick: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 2,
    opacity: 0.6,
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.85,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
  timeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  speedControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 4,
  },
  speedLabel: {
    minWidth: 64,
    textAlign: 'center',
    marginRight: 4,
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
  },
  speedButtonActive: {
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  speedButtonText: {
    fontSize: 12,
  },
});

export default CompareSyncPlaybackCard;
