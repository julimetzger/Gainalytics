import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Text, useTheme} from 'react-native-paper';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {getVideoAnalysisVisualStatus} from '../../utils/video-analysis-presentation';

interface Props {
  status: VideoAnalysisStatus;
}

const VideoAnalysisStatusPill = ({status}: Props) => {
  const theme = useTheme();
  const visualStatus = getVideoAnalysisVisualStatus(status);

  const palette =
    visualStatus === 'done'
      ? {
          backgroundColor: theme.colors.primaryContainer,
          color: theme.colors.onPrimaryContainer,
          icon: 'check-circle',
          label: 'Done',
        }
      : visualStatus === 'failed'
        ? {
            backgroundColor: theme.colors.errorContainer,
            color: theme.colors.onErrorContainer,
            icon: 'alert-circle',
            label: 'Failed',
          }
        : {
            backgroundColor: theme.colors.elevation.level3,
            color: theme.colors.onSurfaceVariant,
            icon: 'progress-clock',
            label: 'Queued',
          };

  return (
    <View style={[styles.container, {backgroundColor: palette.backgroundColor}]} testID={`video-analysis-status-pill-${status}`}>
      <Icon source={palette.icon} size={14} color={palette.color} />
      <Text variant="labelSmall" style={[styles.label, {color: palette.color}]}>
        {palette.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontWeight: '600',
  },
});

export default memo(VideoAnalysisStatusPill);
