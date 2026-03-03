import React, {useEffect, useMemo, useState} from 'react';
import {Image, LayoutChangeEvent, ScrollView, StyleSheet, View} from 'react-native';
import RNFS from 'react-native-fs';
import {Button, Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarPathPoint, BarTrackingResult} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {getVideoAnalysisPreviewPath, readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisDetail'> {}

interface OverlayPoint {
  key: string;
  x: number;
  y: number;
}

const OVERLAY_PADDING = 10;

const mapPointsToOverlay = (barPathSeries: BarPathPoint[], width: number, height: number): OverlayPoint[] => {
  if (barPathSeries.length === 0 || width <= OVERLAY_PADDING * 2 || height <= OVERLAY_PADDING * 2) {
    return [];
  }

  const xValues = barPathSeries.map((point) => point.x);
  const yValues = barPathSeries.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xSpan = Math.max(1, maxX - minX);
  const ySpan = Math.max(1, maxY - minY);
  const xRange = width - OVERLAY_PADDING * 2;
  const yRange = height - OVERLAY_PADDING * 2;

  return barPathSeries.map((point, index) => ({
    key: `${point.tMs}-${index}`,
    x: OVERLAY_PADDING + ((point.x - minX) / xSpan) * xRange,
    y: OVERLAY_PADDING + ((point.y - minY) / ySpan) * yRange,
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
  const [result, setResult] = useState<BarTrackingResult | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    readBarTrackingResultFromFile(analysis?.resultPath).then((loadedResult) => setResult(loadedResult));
  }, [analysis?.resultPath]);

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (analysis?.id === undefined) {
        setPreviewUri(undefined);
        return;
      }

      const previewPath = getVideoAnalysisPreviewPath(analysis.id);
      const exists = await RNFS.exists(previewPath);
      if (active) {
        setPreviewUri(exists ? `file://${previewPath}` : undefined);
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [analysis?.id, analysis?.resultPath]);

  const overlayPoints = useMemo(
    () => mapPointsToOverlay(result?.barPathSeries ?? [], overlayWidth, overlayHeight),
    [result?.barPathSeries, overlayWidth, overlayHeight],
  );

  const onOverlayLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setOverlayWidth(width);
    setOverlayHeight(height);
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
        <Card.Title title="Video Overlay Preview" />
        <Card.Content>
          <Text style={styles.overlayHint}>
            Static preview only: one extracted video frame with projected bar-path points. Playback-synced overlay is not implemented yet.
          </Text>
          {!previewUri && <Text>No preview frame available yet.</Text>}
          {previewUri && (
            <>
              <View
                testID="video-analysis-overlay-preview"
                style={[styles.previewContainer, themedStyles.previewBackground]}
                onLayout={onOverlayLayout}
              >
                <Image source={{uri: previewUri}} style={styles.previewImage} resizeMode="cover" />
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
    aspectRatio: 16 / 9,
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
