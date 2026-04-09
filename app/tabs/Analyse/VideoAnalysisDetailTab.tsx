import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Image, LayoutChangeEvent, ScrollView, StyleSheet, View} from 'react-native';
import RNFS from 'react-native-fs';
import {Button, Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarPathPoint, BarTrackingResult, DetectedBox, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {getVideoAnalysisPreviewPath, readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import VideoAnalysisPlaybackOverlayCard from '../../components/video/VideoAnalysisPlaybackOverlayCard';
import VideoAnalysisManualSeedCard from '../../components/video/VideoAnalysisManualSeedCard';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {ManualSeedPayload, analyzeSquatVideo, migrateBarTrackingResultIfNeeded} from '../../utils/videoAnalysisNative';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisDetail'> {}

interface OverlayPoint {
  key: string;
  x: number;
  y: number;
}

interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
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

const mapInitialSeedBoxToOverlay = (
  initialSeedBox: DetectedBox | undefined,
  overlayWidth: number,
  overlayHeight: number,
  previewDimensions: PreviewDimensions,
  trackingFrameWidthPx?: number,
  trackingFrameHeightPx?: number,
): OverlayBox | undefined => {
  if (!initialSeedBox || overlayWidth <= 0 || overlayHeight <= 0 || previewDimensions.width <= 0 || previewDimensions.height <= 0) {
    return undefined;
  }

  const imageScale = Math.min(overlayWidth / previewDimensions.width, overlayHeight / previewDimensions.height);
  const renderedWidth = previewDimensions.width * imageScale;
  const renderedHeight = previewDimensions.height * imageScale;
  const offsetX = (overlayWidth - renderedWidth) / 2;
  const offsetY = (overlayHeight - renderedHeight) / 2;

  const isNormalized =
    initialSeedBox.x >= 0 &&
    initialSeedBox.y >= 0 &&
    initialSeedBox.width > 0 &&
    initialSeedBox.height > 0 &&
    initialSeedBox.x <= 1.0 &&
    initialSeedBox.y <= 1.0 &&
    initialSeedBox.width <= 1.0 &&
    initialSeedBox.height <= 1.0;

  const normalizedX = isNormalized
    ? initialSeedBox.x
    : trackingFrameWidthPx && trackingFrameWidthPx > 0
      ? initialSeedBox.x / trackingFrameWidthPx
      : 0.5;
  const normalizedY = isNormalized
    ? initialSeedBox.y
    : trackingFrameHeightPx && trackingFrameHeightPx > 0
      ? initialSeedBox.y / trackingFrameHeightPx
      : 0.5;
  const normalizedWidth = isNormalized
    ? initialSeedBox.width
    : trackingFrameWidthPx && trackingFrameWidthPx > 0
      ? initialSeedBox.width / trackingFrameWidthPx
      : 0.1;
  const normalizedHeight = isNormalized
    ? initialSeedBox.height
    : trackingFrameHeightPx && trackingFrameHeightPx > 0
      ? initialSeedBox.height / trackingFrameHeightPx
      : 0.1;

  const width = Math.max(2, normalizedWidth * renderedWidth);
  const height = Math.max(2, normalizedHeight * renderedHeight);

  return {
    left: offsetX + normalizedX * renderedWidth - width / 2,
    top: offsetY + normalizedY * renderedHeight - height / 2,
    width,
    height,
  };
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
    initialSeedBox: {
      borderColor: theme.colors.tertiary,
    },
  });

const VideoAnalysisDetailTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const analysis = useVideoAnalysis(route.params.analysisId);
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
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

      const migratedResultPath = await migrateBarTrackingResultIfNeeded(analysis.resultPath);
      const loadedResult = await readBarTrackingResultFromFile(migratedResultPath ?? analysis.resultPath);
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

  const initialSeedBox = useMemo(
    () =>
      mapInitialSeedBoxToOverlay(
        result?.analysisMeta.initialSeedBox,
        overlayWidth,
        overlayHeight,
        previewDimensions,
        result?.analysisMeta.trackingFrameWidthPx,
        result?.analysisMeta.trackingFrameHeightPx,
      ),
    [
      overlayHeight,
      overlayWidth,
      previewDimensions,
      result?.analysisMeta.initialSeedBox,
      result?.analysisMeta.trackingFrameHeightPx,
      result?.analysisMeta.trackingFrameWidthPx,
    ],
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
        setVideoAnalysisStatus(analysis.id, VideoAnalysisStatus.FAILED, 'Seeded analysis failed');
      } finally {
        setManualSeedRunning(false);
      }
    },
    [analysis?.id, analysis?.localVideoPath, attachVideoAnalysisResult, setManualSeedFramePath, setVideoAnalysisStatus],
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
              <Text>Source FPS: {result.analysisMeta.sourceFps}</Text>
              <Text>Analyzed FPS: {result.analysisMeta.analyzedFps}</Text>
              <Text>Average Confidence: {result.analysisMeta.averageConfidence.toFixed(2)}</Text>
              <Text>Manual Seed Used: {result.analysisMeta.manualSeedUsed ? 'Yes' : 'No'}</Text>
              <Text>Detected Boxes @ t=0: {result.analysisMeta.detectedBoxesAtStart?.length ?? 0}</Text>
              <Text>Quality Flags: {result.qualityFlags.join(', ') || 'None'}</Text>
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
              analysisId={analysis.id!}
              localVideoPath={analysis.localVideoPath}
              result={result}
              savedSetResult={analysis.setResult}
            />
          )}
        </Card.Content>
      </Card>

      {analysis.status === VideoAnalysisStatus.AWAITING_SEED_SELECTION && (
        <VideoAnalysisManualSeedCard
          previewUri={previewUri}
          previewDimensions={previewDimensions}
          busy={manualSeedRunning}
          title="Select Initial Plate"
          subtitle="Choose the correct detected outer plate to start analysis"
          actionLabel="Start Analysis"
          suggestedBoxes={analysis.seedCandidates}
          onRunManualSeedAnalysis={runManualSeedAnalysis}
        />
      )}

      <Divider style={styles.divider} />

      <Card style={styles.card}>
        <Card.Title title="Static Overlay Preview (t=0)" />
        <Card.Content>
          <Text style={styles.overlayHint}>First frame with full bar-path points and highlighted initial plate box.</Text>
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
                    {initialSeedBox && (
                      <View
                        testID="video-analysis-overlay-initial-box"
                        style={[
                          styles.initialSeedBox,
                          themedStyles.initialSeedBox,
                          {
                            left: initialSeedBox.left,
                            top: initialSeedBox.top,
                            width: initialSeedBox.width,
                            height: initialSeedBox.height,
                          },
                        ]}
                      />
                    )}
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
  initialSeedBox: {
    position: 'absolute',
    borderWidth: 2,
  },
  overlayToggle: {
    marginTop: 10,
  },
  overlayHint: {
    marginBottom: 10,
  },
});

export default VideoAnalysisDetailTab;
