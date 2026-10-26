import React from 'react';
import {StyleSheet, View} from 'react-native';
import {SegmentedButtons, Text, useTheme} from 'react-native-paper';
import {resolveVideoAnalysisFps, VIDEO_ANALYSIS_FPS_OPTIONS} from '../../models/VideoAnalysisFps';
import {useVideoAnalysisFps} from '../../redux/settings/use/useVideoAnalysisFps';
import {useSetVideoAnalysisFps} from '../../redux/settings/dispatch/dispatchSetVideoAnalysisFps';

const BUTTONS = VIDEO_ANALYSIS_FPS_OPTIONS.map((fps) => ({
  value: String(fps),
  label: `${fps} FPS`,
  testID: `settings-video-analysis-fps-${fps}`,
}));

/** GH-621: frames per second the bar-path analysis samples. Only new analyses use it. */
const VideoAnalysisFpsSelector = () => {
  const theme = useTheme();
  const fps = useVideoAnalysisFps();
  const setFps = useSetVideoAnalysisFps();

  return (
    <View style={styles.container} testID="settings-video-analysis-fps">
      <Text variant="labelMedium" style={styles.label}>
        Analysis frame rate
      </Text>
      <SegmentedButtons
        value={String(fps)}
        onValueChange={(value) => setFps(resolveVideoAnalysisFps(Number(value)))}
        buttons={BUTTONS}
        density="small"
      />
      <Text variant="bodySmall" style={[styles.hint, {color: theme.colors.onSurfaceVariant}]} testID="settings-video-analysis-fps-hint">
        Higher = more precise bar path and velocity, but slower analysis.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginVertical: 4},
  label: {marginBottom: 4},
  hint: {marginTop: 4},
});

export default VideoAnalysisFpsSelector;
