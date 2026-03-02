import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Card, Divider, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {BarTrackingResult} from '../../models/entities/VideoAnalysis';
import {readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisDetail'> {}

const VideoAnalysisDetailTab = ({route}: Props) => {
  const theme = useTheme();
  const analysis = useVideoAnalysis(route.params.analysisId);
  const [result, setResult] = useState<BarTrackingResult | undefined>();

  useEffect(() => {
    readBarTrackingResultFromFile(analysis?.resultPath).then((loadedResult) => setResult(loadedResult));
  }, [analysis?.resultPath]);

  if (!analysis) {
    return (
      <View style={[styles.centered, {backgroundColor: theme.colors.background}]}>
        <Text>Video analysis not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, {backgroundColor: theme.colors.background}]} contentInsetAdjustmentBehavior="automatic">
      <Card style={styles.card}>
        <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
        <Card.Content>
          <Text>Status: {analysis.status}</Text>
          <Text>Source: {analysis.sourceUri}</Text>
          {analysis.localVideoPath && <Text>Local Video: {analysis.localVideoPath}</Text>}
          {analysis.error && <Text style={{color: theme.colors.error}}>Error: {analysis.error}</Text>}
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      <Card style={styles.card}>
        <Card.Title title="Bar Tracking Result" />
        <Card.Content>
          {!result && <Text>No analysis result available yet.</Text>}
          {result && (
            <>
              <Text>Schema Version: {result.schemaVersion}</Text>
              <Text>Bar Path Points: {result.barPathSeries.length}</Text>
              <Text>Confidence Points: {result.confidenceSeries.length}</Text>
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
