import React, {memo} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Icon, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {VideoAnalysis, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useExercise} from '../../redux/Exercises/use/useExercise';
import {useTrainingMetadataByWorkoutId} from '../../redux/Workout/use/useTrainingMetadataByWorkoutId';
import {useWorkoutById} from '../../redux/Workout/use/useWorkoutById';
import {
  formatVideoAnalysisMetrics,
  formatVideoAnalysisRelativeDateTime,
  formatVideoAnalysisWeightLabel,
  inferVideoAnalysisMovement,
} from '../../utils/video-analysis-presentation';
import VideoAnalysisProgressBar from './VideoAnalysisProgressBar';
import VideoAnalysisStatusPill from './VideoAnalysisStatusPill';
import VideoAnalysisThumbnail from './VideoAnalysisThumbnail';

interface Props {
  analysis: VideoAnalysis;
  onPress: () => void;
  onDelete?: () => void;
  onLink?: () => void;
  elapsedMs?: number;
  estimatedTotalMs?: number;
  progress?: number;
}

const VideoAnalysisListItem = ({analysis, onPress, onDelete, onLink, elapsedMs, estimatedTotalMs, progress}: Props) => {
  const theme = useTheme();
  const workout = useWorkoutById(analysis.workoutId);
  const exercise = useExercise(analysis.exerciseId ?? workout?.exerciseId);
  const trainingMetadata = useTrainingMetadataByWorkoutId(analysis.workoutId);
  const linkedSet = workout?.sets.find((set) => set.index === analysis.setIndex);
  const exerciseName = exercise?.name ?? 'Unknown Exercise';
  const weightLabel = formatVideoAnalysisWeightLabel(linkedSet?.weight, linkedSet?.reps, analysis.status !== VideoAnalysisStatus.FAILED);
  const contextLabel = `${formatVideoAnalysisRelativeDateTime(analysis.createdAt)} · ${trainingMetadata?.trainingName ?? 'Unlinked workout'}`;
  const metricsLabel = formatVideoAnalysisMetrics(analysis.setResult, exercise?.vlReference);
  const errorLabel = analysis.error ? analysis.error.replace(/^Error:\s*/i, '') : null;
  const movement = inferVideoAnalysisMovement(exerciseName);

  return (
    <TouchableRipple onPress={onPress} style={styles.touchable} testID={`video-analysis-row-${analysis.id}`}>
      <View style={[styles.container, {borderBottomColor: theme.colors.outlineVariant}]}>
        <View style={styles.row}>
          <VideoAnalysisThumbnail movement={movement} status={analysis.status} framePath={analysis.manualSeedFramePath} />
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text variant="titleSmall" style={styles.title} numberOfLines={1}>
                {exerciseName}
              </Text>
              <Text variant="titleSmall" style={styles.loadLabel} numberOfLines={1}>
                {weightLabel}
              </Text>
            </View>
            <View style={styles.contextRow}>
              <Text variant="bodySmall" style={[styles.contextText, {color: theme.colors.onSurfaceVariant}]} numberOfLines={1}>
                {contextLabel}
              </Text>
              {trainingMetadata?.micro !== undefined && (
                <View style={[styles.microBadge, {backgroundColor: theme.colors.elevation.level3}]}>
                  <Text variant="labelSmall" style={[styles.microBadgeText, {color: theme.colors.onSurfaceVariant}]}>
                    {`M${trainingMetadata.micro}`}
                  </Text>
                </View>
              )}
            </View>
            {analysis.status === VideoAnalysisStatus.DONE && metricsLabel && (
              <Text variant="bodySmall" style={[styles.subRowText, {color: theme.colors.onSurfaceVariant}]} numberOfLines={1}>
                {metricsLabel}
              </Text>
            )}
            {analysis.status === VideoAnalysisStatus.FAILED && errorLabel && (
              <Text variant="bodySmall" style={[styles.subRowText, {color: theme.colors.error}]} numberOfLines={1}>
                {errorLabel}
              </Text>
            )}
          </View>
          <View style={styles.trailing}>
            <VideoAnalysisStatusPill status={analysis.status} />
            {(onDelete || onLink) && (
              <View style={styles.actionsRow}>
                {onLink && !analysis.workoutId && (
                  <TouchableOpacity onPress={onLink} testID={`video-analysis-link-set-${analysis.id}`} style={styles.actionButton}>
                    <Icon source="link-variant" size={16} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity onPress={onDelete} testID={`video-analysis-delete-${analysis.id}`} style={styles.actionButton}>
                    <Icon source="delete-outline" size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
        {progress !== undefined && elapsedMs !== undefined && estimatedTotalMs !== undefined && analysis.id !== undefined && (
          <VideoAnalysisProgressBar
            elapsedMs={elapsedMs}
            estimatedTotalMs={estimatedTotalMs}
            progress={progress}
            testID={`video-analysis-progress-${analysis.id}`}
          />
        )}
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  touchable: {
    paddingHorizontal: 16,
  },
  container: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 80,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  loadLabel: {
    fontWeight: '600',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  contextText: {
    flex: 1,
  },
  microBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  microBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  subRowText: {
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    padding: 2,
  },
});

export default memo(VideoAnalysisListItem);
