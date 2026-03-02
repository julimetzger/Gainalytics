import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {BarTrackingResult} from '../../models/entities/VideoAnalysis';
import {readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisDetail'> {}

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.error,
    },
  });

const VideoAnalysisDetailTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const analysis = useVideoAnalysis(route.params.analysisId);
  const [result, setResult] = useState<BarTrackingResult | undefined>();

  useEffect(() => {
    readBarTrackingResultFromFile(analysis?.resultPath).then((loadedResult) => setResult(loadedResult));
  }, [analysis?.resultPath]);

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
              <Text testID="video-analysis-detail-schema-version">Schema Version: {result.schemaVersion}</Text>
              <Text testID="video-analysis-detail-bar-points">Bar Path Points: {result.barPathSeries.length}</Text>
              <Text testID="video-analysis-detail-confidence-points">Confidence Points: {result.confidenceSeries.length}</Text>
              <Text>Horizontal Drift: {result.metrics.horizontalDriftPx.toFixed(2)} px</Text>
              <Text>Path Efficiency: {result.metrics.pathEfficiency.toFixed(2)}</Text>
              <Text>Max Ascent Velocity: {result.metrics.maxAscentVelocity.toFixed(2)}</Text>
              <Text>
                Sticking Region: {result.metrics.stickingRegion.startMs}ms - {result.metrics.stickingRegion.endMs}ms
              </Text>
              <Text>Quality Flags: {result.qualityFlags.join(', ') || 'None'}</Text>
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
});

export default VideoAnalysisDetailTab;
