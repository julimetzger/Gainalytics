import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Text} from 'react-native-paper';
import {VideoAnalysis, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';

interface Props {
  analysis: VideoAnalysis;
  analyzedFps?: number;
  playbackUri?: string;
  videoSecured: boolean;
  canSecureVideo: boolean;
  securingVideo: boolean;
  sourceAvailable?: boolean;
  onSecureVideo: () => void;
  onCompare: () => void;
}

/**
 * GH-681: technical details and the secondary actions (secure video, compare) of a
 * video analysis. Rendered at the bottom of the detail screen, below the video.
 */
const VideoAnalysisDetailsCard = ({
  analysis,
  analyzedFps,
  playbackUri,
  videoSecured,
  canSecureVideo,
  securingVideo,
  sourceAvailable,
  onSecureVideo,
  onCompare,
}: Props) => (
  <Card style={styles.card} testID="video-analysis-details-card">
    <Card.Title title="Details" />
    <Card.Content>
      <Text testID="video-analysis-detail-status">Status: {analysis.status}</Text>
      {analyzedFps != null && (
        <Text testID="video-analysis-detail-analyzed-fps">Analysed at {Math.round(analyzedFps)} fps</Text>
      )}
      <Text>Source: {analysis.sourceUri}</Text>
      {analysis.localVideoPath && <Text>Local Video: {analysis.localVideoPath}</Text>}

      {playbackUri && (
        <View style={styles.secureActionsInner}>
          <Button
            testID="video-analysis-secure-video-button"
            mode={videoSecured ? 'outlined' : 'contained'}
            icon={videoSecured ? 'check-circle-outline' : 'download'}
            disabled={!canSecureVideo || securingVideo}
            loading={securingVideo}
            onPress={onSecureVideo}
            style={styles.secureButton}
          >
            {videoSecured ? 'Video secured in app' : 'Secure video in app'}
          </Button>
          <Text testID="video-analysis-secure-video-hint" variant="bodySmall" style={styles.secureHint}>
            {videoSecured
              ? 'This video is stored in the app and will be kept, even if you delete it from the gallery.'
              : sourceAvailable === false
                ? 'The source video is no longer in the gallery and can no longer be imported into the app.'
                : 'Saves the video into the app. It will then be kept, even if you delete it from the gallery.'}
          </Text>
        </View>
      )}
    </Card.Content>
    {analysis.status === VideoAnalysisStatus.DONE && (
      <Card.Actions>
        <Button testID="video-analysis-compare-button" mode="outlined" onPress={onCompare}>
          Compare
        </Button>
      </Card.Actions>
    )}
  </Card>
);

const styles = StyleSheet.create({
  card: {
    margin: 10,
  },
  secureActionsInner: {
    marginTop: 12,
  },
  secureButton: {
    alignSelf: 'flex-start',
  },
  secureHint: {
    marginTop: 6,
  },
});

export default memo(VideoAnalysisDetailsCard);
