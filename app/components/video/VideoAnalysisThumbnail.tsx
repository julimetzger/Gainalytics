import React, {memo} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Icon, useTheme} from 'react-native-paper';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {withAlpha} from '../../utils/colorUtils';
import {VideoAnalysisMovement, getVideoAnalysisVisualStatus} from '../../utils/video-analysis-presentation';

interface Props {
  movement: VideoAnalysisMovement;
  status: VideoAnalysisStatus;
  framePath?: string;
}

const ICON_BY_MOVEMENT: Record<VideoAnalysisMovement, string> = {
  squat: 'weight-lifter',
  bench: 'bed-empty',
  deadlift: 'dumbbell',
  ohp: 'arm-flex',
  row: 'rowing',
  default: 'barbell',
};

const VideoAnalysisThumbnail = ({movement, status, framePath}: Props) => {
  const theme = useTheme();
  const visualStatus = getVideoAnalysisVisualStatus(status);
  const overlayColor = withAlpha(theme.colors.scrim, 0.28);
  const frameUri = framePath ? `file://${framePath}` : undefined;

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.surfaceVariant}]}>
      {frameUri ? (
        <Image source={{uri: frameUri}} key={frameUri} style={styles.frameImage} resizeMode="cover" />
      ) : (
        <Icon source={ICON_BY_MOVEMENT[movement]} size={30} color={theme.colors.primary} />
      )}
      {visualStatus !== 'done' && <View style={[styles.dimOverlay, {backgroundColor: overlayColor}]} />}
      {visualStatus === 'done' ? (
        <View style={[styles.cornerBadge, {backgroundColor: theme.colors.surface}]}>
          <Icon source="play" size={12} color={theme.colors.primary} />
        </View>
      ) : (
        <View style={[styles.centerBadge, {backgroundColor: visualStatus === 'failed' ? theme.colors.errorContainer : theme.colors.elevation.level3}]}>
          <Icon source={visualStatus === 'failed' ? 'alert-circle' : 'progress-clock'} size={18} color={visualStatus === 'failed' ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  frameImage: {
    width: 64,
    height: 64,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cornerBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBadge: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(VideoAnalysisThumbnail);
