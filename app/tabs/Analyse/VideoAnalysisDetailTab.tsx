import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image, LayoutChangeEvent, ScrollView, StyleSheet, View} from 'react-native';
import RNFS from 'react-native-fs';
import {Button, Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarPathPoint, BarTrackingResult, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {getVideoAnalysisPreviewPath, readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import VideoAnalysisPlayerView, {VideoPlayerLoadEvent, VideoPlayerProgressEvent} from '../../components/video/VideoAnalysisPlayerView';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisDetail'> {}

interface OverlayPoint {
  key: string;
  x: number;
  y: number;
}

interface PreviewDimensions {
  width: number;
  height: number;
}

const DEFAULT_PREVIEW_ASPECT_RATIO = 16 / 9;
const DEFAULT_PREVIEW_DIMENSIONS: PreviewDimensions = {width: 1600, height: 900};

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

const interpolateBarPoint = (barPathSeries: BarPathPoint[], targetMs: number): BarPathPoint | undefined => {
  if (barPathSeries.length === 0) {
    return undefined;
  }
  if (barPathSeries.length === 1) {
    return barPathSeries[0];
  }

  if (targetMs <= barPathSeries[0].tMs) {
    return barPathSeries[0];
  }
  const lastPoint = barPathSeries[barPathSeries.length - 1];
  if (targetMs >= lastPoint.tMs) {
    return lastPoint;
  }

  for (let index = 1; index < barPathSeries.length; index++) {
    const nextPoint = barPathSeries[index];
    if (nextPoint.tMs < targetMs) {
      continue;
    }
    const previousPoint = barPathSeries[index - 1];
    const deltaMs = nextPoint.tMs - previousPoint.tMs;
    if (deltaMs <= 0) {
      return nextPoint;
    }

    const ratio = clamp((targetMs - previousPoint.tMs) / deltaMs, 0, 1);
    return {
      tMs: Math.round(targetMs),
      x: previousPoint.x + (nextPoint.x - previousPoint.x) * ratio,
      y: previousPoint.y + (nextPoint.y - previousPoint.y) * ratio,
    };
  }

  return lastPoint;
};

const interpolateBarPointByIndex = (barPathSeries: BarPathPoint[], indexValue: number): BarPathPoint | undefined => {
  if (barPathSeries.length === 0) {
    return undefined;
  }
  if (barPathSeries.length === 1) {
    return barPathSeries[0];
  }

  const clampedIndex = clamp(indexValue, 0, barPathSeries.length - 1);
  const lowerIndex = Math.floor(clampedIndex);
  const upperIndex = Math.ceil(clampedIndex);
  const lowerPoint = barPathSeries[lowerIndex];
  const upperPoint = barPathSeries[upperIndex];
  if (!lowerPoint || !upperPoint || lowerIndex === upperIndex) {
    return lowerPoint ?? upperPoint;
  }

  const ratio = clampedIndex - lowerIndex;
  return {
    tMs: Math.round(lowerPoint.tMs + ((upperPoint.tMs - lowerPoint.tMs) * ratio)),
    x: lowerPoint.x + ((upperPoint.x - lowerPoint.x) * ratio),
    y: lowerPoint.y + ((upperPoint.y - lowerPoint.y) * ratio),
  };
};

const estimateCycleDurationMs = (barPathSeries: BarPathPoint[]): number | undefined => {
  if (barPathSeries.length < 24) {
    return undefined;
  }

  const ySeries = barPathSeries.map((point) => point.y);
  const meanY = ySeries.reduce((sum, y) => sum + y, 0) / ySeries.length;
  const centered = ySeries.map((y) => y - meanY);

  const n = centered.length;
  const minLag = Math.max(4, Math.floor(n * 0.015));
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(n * 0.2));
  if (maxLag <= minLag) {
    return undefined;
  }

  let bestLag = -1;
  let bestCorrelation = Number.NEGATIVE_INFINITY;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    for (let index = 0; index < n - lag; index++) {
      correlation += centered[index] * centered[index + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) {
    return undefined;
  }

  const totalDurationMs = Math.max(1, barPathSeries[n - 1].tMs - barPathSeries[0].tMs);
  const avgFrameDurationMs = totalDurationMs / Math.max(1, n - 1);
  const estimatedCycleMs = bestLag * avgFrameDurationMs;
  if (!Number.isFinite(estimatedCycleMs) || estimatedCycleMs < 250 || estimatedCycleMs > 5000) {
    return undefined;
  }

  return estimatedCycleMs;
};

const mapPointsToOverlay = (
  barPathSeries: BarPathPoint[],
  overlayWidth: number,
  overlayHeight: number,
  previewDimensions: PreviewDimensions,
  trackingFrameWidthPx?: number,
  trackingFrameHeightPx?: number,
): OverlayPoint[] => {
  if (barPathSeries.length === 0 || overlayWidth <= 0 || overlayHeight <= 0 || previewDimensions.width <= 0 || previewDimensions.height <= 0) {
    return [];
  }

  const imageScale = Math.min(overlayWidth / previewDimensions.width, overlayHeight / previewDimensions.height);
  const renderedWidth = previewDimensions.width * imageScale;
  const renderedHeight = previewDimensions.height * imageScale;
  const offsetX = (overlayWidth - renderedWidth) / 2;
  const offsetY = (overlayHeight - renderedHeight) / 2;

  if (trackingFrameWidthPx && trackingFrameHeightPx && trackingFrameWidthPx > 0 && trackingFrameHeightPx > 0) {
    const xScale = (previewDimensions.width / trackingFrameWidthPx) * imageScale;
    const yScale = (previewDimensions.height / trackingFrameHeightPx) * imageScale;

    return barPathSeries.map((point, index) => ({
      key: `${point.tMs}-${index}`,
      x: offsetX + point.x * xScale,
      y: offsetY + point.y * yScale,
    }));
  }

  // Compatibility fallback for older stored analyses that do not include tracking frame dimensions.
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

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.error,
    },
    previewBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    overlayPoint: {
      backgroundColor: theme.colors.primary,
    },
    liveOverlayPoint: {
      backgroundColor: theme.colors.error,
    },
  });

const VideoAnalysisDetailTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const analysis = useVideoAnalysis(route.params.analysisId);
  const [result, setResult] = useState<BarTrackingResult | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [previewAspectRatio, setPreviewAspectRatio] = useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions>(DEFAULT_PREVIEW_DIMENSIONS);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [playbackPaused, setPlaybackPaused] = useState(true);
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
  const [nativePlaybackTimeMs, setNativePlaybackTimeMs] = useState(0);
  const [nativePlaybackDurationMs, setNativePlaybackDurationMs] = useState(0);
  const [playbackDimensions, setPlaybackDimensions] = useState<PreviewDimensions>(DEFAULT_PREVIEW_DIMENSIONS);
  const [playbackAspectRatio, setPlaybackAspectRatio] = useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [playbackOverlayWidth, setPlaybackOverlayWidth] = useState(0);
  const [playbackOverlayHeight, setPlaybackOverlayHeight] = useState(0);
  const playbackProgressRef = useRef(0);
  const playbackClockAnchorRef = useRef<{wallMs: number; timeMs: number} | null>(null);

  useEffect(() => {
    let active = true;

    const loadResult = async () => {
      if (!analysis?.resultPath || analysis.status !== VideoAnalysisStatus.DONE) {
        if (active) {
          setResult(undefined);
        }
        return;
      }

      const loadedResult = await readBarTrackingResultFromFile(analysis.resultPath);
      if (active) {
        setResult(loadedResult);
      }
    };

    loadResult();
    return () => {
      active = false;
    };
  }, [analysis?.createdAt, analysis?.id, analysis?.localVideoPath, analysis?.resultPath, analysis?.status]);

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (analysis?.id === undefined) {
        setPreviewUri(undefined);
        setPreviewAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
        setPreviewDimensions(DEFAULT_PREVIEW_DIMENSIONS);
        return;
      }

      const previewPath = getVideoAnalysisPreviewPath(analysis.id);
      const exists = await RNFS.exists(previewPath);
      if (active) {
        if (!exists) {
          setPreviewUri(undefined);
          setPreviewAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
          setPreviewDimensions(DEFAULT_PREVIEW_DIMENSIONS);
          return;
        }

        const uri = `file://${previewPath}`;
        setPreviewUri(uri);
        Image.getSize(
          uri,
          (width, height) => {
            if (active && width > 0 && height > 0) {
              setPreviewAspectRatio(width / height);
              setPreviewDimensions({width, height});
            }
          },
          () => {
            if (active) {
              setPreviewAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
              setPreviewDimensions(DEFAULT_PREVIEW_DIMENSIONS);
            }
          },
        );
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [analysis?.id, analysis?.resultPath]);

  const overlayPoints = useMemo(
    () =>
      mapPointsToOverlay(
        result?.barPathSeries ?? [],
        overlayWidth,
        overlayHeight,
        previewDimensions,
        result?.analysisMeta.trackingFrameWidthPx,
        result?.analysisMeta.trackingFrameHeightPx,
      ),
    [previewDimensions, result?.analysisMeta.trackingFrameHeightPx, result?.analysisMeta.trackingFrameWidthPx, result?.barPathSeries, overlayHeight, overlayWidth],
  );

  const analysisDurationMs = useMemo(() => {
    const points = result?.barPathSeries;
    if (!points || points.length === 0) {
      return 0;
    }
    const firstTime = points[0].tMs;
    const lastTime = points[points.length - 1].tMs;
    return Math.max(0, lastTime - firstTime);
  }, [result?.barPathSeries]);

  const correctedPlaybackDurationMs = useMemo(() => {
    if (playbackDurationMs > 0) {
      return playbackDurationMs;
    }
    if (analysisDurationMs > 0) {
      return analysisDurationMs;
    }
    return 0;
  }, [analysisDurationMs, playbackDurationMs]);

  const syncedAnalysisTimeMs = useMemo(() => {
    if (analysisDurationMs > 0 && playbackDurationMs > 0) {
      const progress = clamp(playbackTimeMs / playbackDurationMs, 0, 1);
      return progress * analysisDurationMs;
    }
    if (analysisDurationMs <= 0) {
      return playbackTimeMs;
    }
    return clamp(playbackTimeMs, 0, analysisDurationMs);
  }, [analysisDurationMs, playbackDurationMs, playbackTimeMs]);

  const playbackProgress = useMemo(() => {
    if (playbackDurationMs > 0) {
      return clamp(playbackTimeMs / playbackDurationMs, 0, 1);
    }
    if (analysisDurationMs > 0) {
      return clamp(playbackTimeMs / analysisDurationMs, 0, 1);
    }
    return 0;
  }, [analysisDurationMs, playbackDurationMs, playbackTimeMs]);

  const syncDebug = useMemo(() => {
    const playbackProgressPercent = playbackDurationMs > 0 ? (playbackTimeMs / playbackDurationMs) * 100 : 0;
    const analysisProgressPercent = analysisDurationMs > 0 ? (syncedAnalysisTimeMs / analysisDurationMs) * 100 : 0;
    return {
      nativePlaybackTimeMs,
      nativePlaybackDurationMs,
      overlayPlaybackTimeMs: playbackTimeMs,
      overlayPlaybackDurationMs: playbackDurationMs,
      analysisTimeMs: syncedAnalysisTimeMs,
      analysisDurationMs,
      playbackProgressPercent: clamp(playbackProgressPercent, 0, 100),
      analysisProgressPercent: clamp(analysisProgressPercent, 0, 100),
      timeDeltaMs: playbackTimeMs - nativePlaybackTimeMs,
    };
  }, [analysisDurationMs, nativePlaybackDurationMs, nativePlaybackTimeMs, playbackDurationMs, playbackTimeMs, syncedAnalysisTimeMs]);

  const currentBarPoint = useMemo(() => {
    const points = result?.barPathSeries;
    if (!points || points.length === 0) {
      return undefined;
    }
    if (playbackDurationMs > 0) {
      const indexValue = playbackProgress * (points.length - 1);
      return interpolateBarPointByIndex(points, indexValue);
    }
    return interpolateBarPoint(points, syncedAnalysisTimeMs);
  }, [playbackDurationMs, playbackProgress, result?.barPathSeries, syncedAnalysisTimeMs]);

  const currentBarOverlayPoint = useMemo(() => {
    if (!currentBarPoint || !result) {
      return undefined;
    }

    const mapped = mapPointsToOverlay(
      [currentBarPoint],
      playbackOverlayWidth,
      playbackOverlayHeight,
      playbackDimensions,
      result.analysisMeta.trackingFrameWidthPx,
      result.analysisMeta.trackingFrameHeightPx,
    );
    return mapped[0];
  }, [currentBarPoint, playbackDimensions, playbackOverlayHeight, playbackOverlayWidth, result]);

  const currentRep = useMemo(() => {
    const segments = result?.repSegments ?? [];
    return segments.find((segment) => syncedAnalysisTimeMs >= segment.startMs && syncedAnalysisTimeMs <= segment.endMs);
  }, [result?.repSegments, syncedAnalysisTimeMs]);

  useEffect(() => {
    setPlaybackPaused(true);
    setPlaybackTimeMs(0);
    setPlaybackDurationMs(0);
    setNativePlaybackTimeMs(0);
    setNativePlaybackDurationMs(0);
    setPlaybackDimensions(DEFAULT_PREVIEW_DIMENSIONS);
    setPlaybackAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
    playbackProgressRef.current = 0;
    playbackClockAnchorRef.current = null;
  }, [analysis?.id, analysis?.localVideoPath]);

  useEffect(() => {
    if (playbackPaused) {
      return;
    }

    const tick = () => {
      const anchor = playbackClockAnchorRef.current;
      if (!anchor) {
        return;
      }

      const extrapolatedMs = anchor.timeMs + (Date.now() - anchor.wallMs);
      const cappedMs = playbackDurationMs > 0 ? Math.min(playbackDurationMs, extrapolatedMs) : extrapolatedMs;
      setPlaybackTimeMs((previousMs) => {
        const nextMs = cappedMs;
        if (Math.abs(nextMs - previousMs) < 16) {
          return previousMs;
        }
        return nextMs;
      });
    };

    tick();
    const intervalId = setInterval(tick, 33);
    return () => clearInterval(intervalId);
  }, [playbackDurationMs, playbackPaused]);

  const onOverlayLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setOverlayWidth(width);
    setOverlayHeight(height);
  };

  const onPlaybackOverlayLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setPlaybackOverlayWidth(width);
    setPlaybackOverlayHeight(height);
  };

  const onPlayerLoad = (event: {nativeEvent?: VideoPlayerLoadEvent}) => {
    if (!event.nativeEvent) {
      return;
    }
    const {durationMs, videoWidth, videoHeight} = event.nativeEvent;
    setNativePlaybackDurationMs(durationMs);
    setPlaybackDurationMs((previousDurationMs) => Math.max(previousDurationMs, durationMs));
    if (videoWidth > 0 && videoHeight > 0) {
      setPlaybackDimensions({width: videoWidth, height: videoHeight});
      setPlaybackAspectRatio(videoWidth / videoHeight);
    }
  };

  const onPlayerProgress = (event: {nativeEvent?: VideoPlayerProgressEvent}) => {
    const nativeEvent = event.nativeEvent;
    if (!nativeEvent) {
      return;
    }

    const currentTimeMs = nativeEvent.currentTimeMs;
    setNativePlaybackTimeMs(currentTimeMs);
    if (nativeEvent.durationMs > 0) {
      setNativePlaybackDurationMs(nativeEvent.durationMs);
      setPlaybackDurationMs((previousDurationMs) => Math.max(previousDurationMs, nativeEvent.durationMs));
    }

    playbackProgressRef.current = currentTimeMs;

    // While actively playing, native currentPosition is unreliable on some devices.
    // Use wall-clock progression for overlay timing and only trust native time when paused.
    if (playbackPaused) {
      playbackClockAnchorRef.current = null;
      setPlaybackTimeMs(currentTimeMs);
    }
  };

  const onPlayerEnd = () => {
    setPlaybackPaused(true);
    playbackClockAnchorRef.current = null;
    if (playbackDurationMs > 0) {
      setPlaybackTimeMs(playbackDurationMs);
      return;
    }
    setPlaybackTimeMs(playbackProgressRef.current);
  };

  if (!analysis) {
    return (
      <View style={[styles.centered, themedStyles.background]} testID="video-analysis-detail-not-found">
        <Text>Video analysis not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="video-analysis-detail-screen"
      style={[styles.container, themedStyles.background]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Card style={styles.card}>
        <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
        <Card.Content>
          <Text testID="video-analysis-detail-status">Status: {analysis.status}</Text>
          <Text>Source: {analysis.sourceUri}</Text>
          {analysis.localVideoPath && <Text>Local Video: {analysis.localVideoPath}</Text>}
          {analysis.error && <Text style={themedStyles.errorText}>Error: {analysis.error}</Text>}
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <Card style={styles.card}>
        <Card.Title title="Bar Tracking Result" />
        <Card.Content>
          {!result && <Text testID="video-analysis-detail-no-result">No analysis result available yet.</Text>}
          {result && (
            <>
              <Text testID="video-analysis-detail-bar-points">Bar Path Points: {result.barPathSeries.length}</Text>
              <Text testID="video-analysis-detail-confidence-points">Confidence Points: {result.confidenceSeries.length}</Text>
              <Text>Units: {result.units}</Text>
              <Text>Rep Segments: {result.repSegments.length}</Text>
              <Text>Rep Metrics: {result.repMetrics.length}</Text>
              <Text>Source FPS: {result.analysisMeta.sourceFps}</Text>
              <Text>Analyzed FPS: {result.analysisMeta.analyzedFps}</Text>
              <Text>Average Confidence: {result.analysisMeta.averageConfidence.toFixed(2)}</Text>
              <Text>Quality Flags: {result.qualityFlags.join(', ') || 'None'}</Text>

              {result.repMetrics.map((repMetric) => (
                <View key={repMetric.repIndex} style={styles.repMetric}>
                  <Text>Rep {repMetric.repIndex}</Text>
                  <Text>Average Speed: {repMetric.averageConcentricSpeedPxPerS.toFixed(2)} px/s</Text>
                  <Text>Lowest Speed: {repMetric.lowestConcentricSpeedPxPerS.toFixed(2)} px/s</Text>
                  <Text>Rep Time: {repMetric.repTimeMs} ms</Text>
                </View>
              ))}
            </>
          )}
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <Card style={styles.card}>
        <Card.Title title="Playback Overlay" />
        <Card.Content>
          {!analysis.localVideoPath && <Text>No local video path available yet.</Text>}
          {analysis.localVideoPath && !result && <Text>No analysis result available yet.</Text>}
          {analysis.localVideoPath && result && (
            <>
              <Text style={styles.overlayHint}>Live playback with current detected bar position.</Text>
              <View
                testID="video-analysis-playback-overlay"
                style={[styles.previewContainer, themedStyles.previewBackground, {aspectRatio: playbackAspectRatio}]}
                onLayout={onPlaybackOverlayLayout}
              >
                <VideoAnalysisPlayerView
                  testID="video-analysis-playback-player"
                  style={styles.previewImage}
                  source={analysis.localVideoPath}
                  paused={playbackPaused}
                  onLoad={onPlayerLoad}
                  onProgress={onPlayerProgress}
                  onEnd={onPlayerEnd}
                />
                <View pointerEvents="none" style={styles.overlayLayer}>
                  {currentBarOverlayPoint && (
                    <View
                      testID="video-analysis-playback-current-point"
                      style={[styles.liveOverlayPoint, themedStyles.liveOverlayPoint, {left: currentBarOverlayPoint.x - 4, top: currentBarOverlayPoint.y - 4}]}
                    />
                  )}
                </View>
              </View>

              <View style={styles.playbackControls}>
                <Button
                  testID="video-analysis-playback-toggle"
                  mode="outlined"
                  onPress={() =>
                    setPlaybackPaused((paused) => {
                      if (paused) {
                        const startMs = Math.max(playbackTimeMs, playbackProgressRef.current);
                        playbackClockAnchorRef.current = {
                          wallMs: Date.now(),
                          timeMs: startMs,
                        };
                        setPlaybackTimeMs(startMs);
                      } else {
                        playbackClockAnchorRef.current = null;
                        setPlaybackTimeMs(playbackProgressRef.current);
                      }
                      return !paused;
                    })
                  }
                >
                  {playbackPaused ? 'Play' : 'Pause'}
                </Button>
                <Text testID="video-analysis-playback-time">
                  Playback: {formatDuration(playbackTimeMs)} / {formatDuration(correctedPlaybackDurationMs)}
                </Text>
                <Text>{currentRep ? `Current Rep: ${currentRep.repIndex}` : 'Current Rep: -'}</Text>
                <View testID="video-analysis-playback-debug" style={styles.playbackDebug}>
                  <Text>Debug Native: {formatDuration(syncDebug.nativePlaybackTimeMs)} / {formatDuration(syncDebug.nativePlaybackDurationMs)}</Text>
                  <Text>Debug Overlay: {formatDuration(syncDebug.overlayPlaybackTimeMs)} / {formatDuration(syncDebug.overlayPlaybackDurationMs)}</Text>
                  <Text>Debug Analysis: {formatDuration(syncDebug.analysisTimeMs)} / {formatDuration(syncDebug.analysisDurationMs)}</Text>
                  <Text>Debug Delta: {Math.round(syncDebug.timeDeltaMs)} ms</Text>
                  <Text>Debug Progress: V {syncDebug.playbackProgressPercent.toFixed(1)}% | A {syncDebug.analysisProgressPercent.toFixed(1)}%</Text>
                </View>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <Card style={styles.card}>
        <Card.Title title="Static Overlay Preview" />
        <Card.Content>
          <Text style={styles.overlayHint}>
            One extracted frame with projected full bar-path points.
          </Text>
          {!previewUri && <Text>No preview frame available yet.</Text>}
          {previewUri && (
            <>
              <View
                testID="video-analysis-overlay-preview"
                style={[styles.previewContainer, themedStyles.previewBackground, {aspectRatio: previewAspectRatio}]}
                onLayout={onOverlayLayout}
              >
                <Image source={{uri: previewUri}} style={styles.previewImage} resizeMode="contain" />
                {showOverlay && (
                  <View pointerEvents="none" style={styles.overlayLayer}>
                    {overlayPoints.map((point, index) => (
                      <View
                        key={point.key}
                        testID={index === 0 ? 'video-analysis-overlay-first-point' : undefined}
                        style={[styles.overlayPoint, themedStyles.overlayPoint, {left: point.x - 2, top: point.y - 2}]}
                      />
                    ))}
                  </View>
                )}
              </View>
              <Button
                testID="video-analysis-overlay-toggle"
                mode="outlined"
                onPress={() => setShowOverlay((isVisible) => !isVisible)}
                style={styles.overlayToggle}
              >
                {showOverlay ? 'Hide Overlay' : 'Show Overlay'}
              </Button>
            </>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 10,
  },
  divider: {
    marginHorizontal: 10,
    marginVertical: 5,
  },
  repMetric: {
    marginTop: 10,
  },
  previewContainer: {
    width: '100%',
    minHeight: 260,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  liveOverlayPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overlayToggle: {
    marginTop: 10,
  },
  overlayHint: {
    marginBottom: 10,
  },
  playbackControls: {
    marginTop: 10,
  },
  playbackDebug: {
    marginTop: 8,
  },
});

export default VideoAnalysisDetailTab;
