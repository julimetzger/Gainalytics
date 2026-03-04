import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Image, LayoutChangeEvent, ScrollView, StyleSheet, View} from 'react-native';
import RNFS from 'react-native-fs';
import {Button, Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarPathPoint, BarTrackingResult, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {getVideoAnalysisPreviewPath, readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import VideoAnalysisPlaybackOverlayCard from '../../components/video/VideoAnalysisPlaybackOverlayCard';
import VideoAnalysisManualSeedCard from '../../components/video/VideoAnalysisManualSeedCard';
import VideoAnalysisWorkoutLinkCard from '../../components/video/VideoAnalysisWorkoutLinkCard';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchLinkVideoAnalysisToWorkout} from '../../redux/VideoAnalysis/dispatch/dispatchLinkVideoAnalysisToWorkout';
import {ManualSeedPayload, analyzeSquatVideo} from '../../utils/videoAnalysisNative';

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
  });

const VideoAnalysisDetailTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const analysis = useVideoAnalysis(route.params.analysisId);
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const linkVideoAnalysisToWorkout = dispatchLinkVideoAnalysisToWorkout();
  const [result, setResult] = useState<BarTrackingResult | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [previewAspectRatio, setPreviewAspectRatio] = useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions>(DEFAULT_PREVIEW_DIMENSIONS);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [manualSeedRunning, setManualSeedRunning] = useState(false);

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

      const previewPath = analysis.manualSeedFramePath ?? getVideoAnalysisPreviewPath(analysis.id);
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
  }, [analysis?.id, analysis?.manualSeedFramePath, analysis?.resultPath]);

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

  const onOverlayLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setOverlayWidth(width);
    setOverlayHeight(height);
  };

  const runManualSeedAnalysis = useCallback(
    async (manualSeed: ManualSeedPayload) => {
      if (!analysis?.id || !analysis.localVideoPath) {
        return;
      }

      try {
        setManualSeedRunning(true);
        setVideoAnalysisStatus(analysis.id, VideoAnalysisStatus.PROCESSING);
        const resultPath = await analyzeSquatVideo(analysis.localVideoPath, analysis.id, manualSeed);
        attachVideoAnalysisResult(analysis.id, resultPath, analysis.localVideoPath);
        setManualSeedFramePath(analysis.id, undefined);
      } catch (error) {
        setVideoAnalysisStatus(analysis.id, VideoAnalysisStatus.FAILED, 'Manual seed analysis failed');
      } finally {
        setManualSeedRunning(false);
      }
    },
    [analysis?.id, analysis?.localVideoPath, attachVideoAnalysisResult, setManualSeedFramePath, setVideoAnalysisStatus],
  );

  const onLinkAnalysisToWorkout = useCallback(
    (workoutId: number, exerciseId?: number, setIndex?: number) => {
      if (!analysis?.id) {
        return;
      }
      linkVideoAnalysisToWorkout(analysis.id, workoutId, exerciseId, setIndex);
    },
    [analysis?.id, linkVideoAnalysisToWorkout],
  );

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
              <Text>Manual Seed Used: {result.analysisMeta.manualSeedUsed ? 'Yes' : 'No'}</Text>
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
            <VideoAnalysisPlaybackOverlayCard
              key={`${analysis.id}-${analysis.localVideoPath}`}
              localVideoPath={analysis.localVideoPath}
              result={result}
            />
          )}
        </Card.Content>
      </Card>

      <VideoAnalysisWorkoutLinkCard linkedWorkoutId={analysis.workoutId} linkedSetIndex={analysis.setIndex} onLink={onLinkAnalysisToWorkout} />

      {analysis.status === VideoAnalysisStatus.NEEDS_MANUAL_SEED && (
        <VideoAnalysisManualSeedCard
          previewUri={previewUri}
          previewDimensions={previewDimensions}
          busy={manualSeedRunning}
          onRunManualSeedAnalysis={runManualSeedAnalysis}
        />
      )}

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
  overlayToggle: {
    marginTop: 10,
  },
  overlayHint: {
    marginBottom: 10,
  },
});

export default VideoAnalysisDetailTab;
