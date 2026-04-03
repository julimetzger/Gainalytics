import React from 'react';
import {StyleSheet, View} from 'react-native';
import {MD3Theme, Text, useTheme} from 'react-native-paper';

interface Props {
  elapsedMs: number;
  estimatedTotalMs: number;
  progress: number;
  testID: string;
}

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    wrapper: {
      marginTop: 12,
    },
    header: {
      marginBottom: 6,
      color: theme.colors.onSurface,
      fontWeight: '700',
    },
    track: {
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      backgroundColor: theme.colors.elevation.level3,
      overflow: 'hidden',
    },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '0%',
      backgroundColor: theme.colors.primary,
    },
    caption: {
      marginTop: 6,
      color: theme.colors.onSurfaceVariant,
    },
  });

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const VideoAnalysisProgressBar = ({elapsedMs, estimatedTotalMs, progress, testID}: Props) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const boundedProgress = Math.max(0, Math.min(progress, 1));
  const visibleProgress = Math.max(0.03, boundedProgress);
  const progressText = `${Math.round(boundedProgress * 100)}%`;
  const caption =
    estimatedTotalMs > 0
      ? `${formatDuration(Math.min(elapsedMs, estimatedTotalMs))} / ${formatDuration(estimatedTotalMs)} estimated`
      : 'Reading video duration...';

  return (
    <View style={themedStyles.wrapper}>
      <Text variant="labelLarge" style={themedStyles.header}>
        Progress {progressText}
      </Text>
      <View style={themedStyles.track} testID={testID}>
        <View style={[themedStyles.fill, {width: `${Math.round(visibleProgress * 100)}%`}]} />
      </View>
      <Text variant="bodySmall" style={themedStyles.caption}>
        {caption}
      </Text>
    </View>
  );
};

export default VideoAnalysisProgressBar;
