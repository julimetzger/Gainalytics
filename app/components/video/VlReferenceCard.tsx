import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import {VideoAnalysis} from '../../models/entities/VideoAnalysis';
import {useExercise} from '../../redux/Exercises/use/useExercise';
import {useWorkoutById} from '../../redux/Workout/use/useWorkoutById';
import {useVideoAnalysisExerciseId} from '../../redux/VideoAnalysis/use/useVideoAnalysisExerciseId';
import {dispatchSetExerciseVlReference} from '../../redux/Exercises/dispatch/dispatchSetExerciseVlReference';
import {dispatchClearExerciseVlReference} from '../../redux/Exercises/dispatch/dispatchClearExerciseVlReference';
import {
  MAX_REFERENCE_RIR,
  MIN_REFERENCE_RIR,
  formatVlReferenceLabel,
  isValidReferenceRir,
  isVlReferenceActive,
  vlToRirEstimate,
} from '../../utils/velocityLossRir';
import VlReferenceDialog from './VlReferenceDialog';

interface Props {
  analysis: VideoAnalysis;
}

/**
 * Turns one analysed set into the VL reference of its exercise (issue #316).
 * The RIR estimate shown here always reflects the curve that exercise currently
 * uses, so setting or removing the reference is visible on the spot.
 */
const VlReferenceCard = ({analysis}: Props) => {
  const theme = useTheme();
  const workout = useWorkoutById(analysis.workoutId);
  const exerciseId = useVideoAnalysisExerciseId(analysis);
  const exercise = useExercise(exerciseId);
  const setVlReference = dispatchSetExerciseVlReference();
  const clearVlReference = dispatchClearExerciseVlReference();
  const [dialogVisible, setDialogVisible] = useState(false);

  const velocityLossPercent = analysis.setResult?.velocityLossPercent ?? null;
  const reportedRir = workout?.sets?.find((set) => set.index === analysis.setIndex)?.rir;
  const reference = exercise?.vlReference;
  const referenced = isVlReferenceActive(reference);
  const referenceLabel = formatVlReferenceLabel(reference);

  const hasUsableVl = velocityLossPercent !== null && Number.isFinite(velocityLossPercent) && velocityLossPercent > 0;

  const blockedReason = useMemo(() => {
    if (exerciseId === undefined) {
      return 'Link this analysis to a workout set first — a VL reference always belongs to one exercise.';
    }
    if (!hasUsableVl) {
      return 'This set has no measured velocity loss yet. Confirm its reps in the playback overlay and save the set result first.';
    }
    if (reportedRir !== undefined && !isValidReferenceRir(reportedRir)) {
      return `This set was logged at RIR ${reportedRir}. Only sets taken to RIR ${MIN_REFERENCE_RIR}–${MAX_REFERENCE_RIR} can anchor the curve — further from failure the velocity signal is too flat.`;
    }
    return null;
  }, [exerciseId, hasUsableVl, reportedRir]);

  const rirEstimate = hasUsableVl ? vlToRirEstimate(velocityLossPercent!, reference) : null;

  const onConfirm = useCallback(
    (rir: number) => {
      setDialogVisible(false);
      if (exerciseId === undefined || !hasUsableVl || analysis.id === undefined) {
        return;
      }
      setVlReference(exerciseId, {
        rir,
        velocityLossPercent: velocityLossPercent!,
        referencedAt: new Date().toISOString(),
        analysisId: analysis.id,
        workoutId: analysis.workoutId,
        setIndex: analysis.setIndex,
      });
    },
    [analysis.id, analysis.setIndex, analysis.workoutId, exerciseId, hasUsableVl, setVlReference, velocityLossPercent],
  );

  const onRemove = useCallback(() => {
    if (exerciseId !== undefined) {
      clearVlReference(exerciseId);
    }
  }, [clearVlReference, exerciseId]);

  return (
    <Card style={styles.card} testID="vl-reference-card">
      <Card.Title title="VL Reference" subtitle={exercise?.name ?? 'No exercise linked'} />
      <Card.Content>
        <View style={styles.metricsRow}>
          <Text variant="titleMedium" style={{color: theme.colors.primary}} testID="vl-reference-vl-percent">
            {hasUsableVl ? `${velocityLossPercent!.toFixed(1)}% VL` : 'No VL'}
          </Text>
          <Text variant="titleMedium" testID="vl-reference-rir-estimate">
            {rirEstimate !== null ? `RIR ${rirEstimate}` : 'RIR –'}
          </Text>
        </View>

        {referenced ? (
          <Text variant="labelMedium" style={[styles.badge, {backgroundColor: theme.colors.secondaryContainer, color: theme.colors.onSecondaryContainer}]} testID="vl-reference-badge">
            {referenceLabel}
          </Text>
        ) : (
          <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="vl-reference-global-hint">
            {`${exercise?.name ?? 'This exercise'} uses the global VL curve.`}
          </Text>
        )}

        {blockedReason !== null && (
          <Text variant="bodySmall" style={[styles.blocked, {color: theme.colors.error}]} testID="vl-reference-blocked-reason">
            {blockedReason}
          </Text>
        )}
      </Card.Content>
      <Card.Actions>
        {referenced && (
          <Button testID="vl-reference-remove-button" mode="outlined" onPress={onRemove}>
            Remove reference
          </Button>
        )}
        <Button
          testID="vl-reference-set-button"
          mode="contained"
          disabled={blockedReason !== null}
          onPress={() => setDialogVisible(true)}
        >
          {referenced ? 'Replace reference' : 'Set as VL reference'}
        </Button>
      </Card.Actions>

      {hasUsableVl && (
        <VlReferenceDialog
          visible={dialogVisible}
          exerciseName={exercise?.name ?? 'This exercise'}
          velocityLossPercent={velocityLossPercent!}
          reportedRir={reportedRir}
          onConfirm={onConfirm}
          onDismiss={() => setDialogVisible(false)}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  blocked: {
    marginTop: 8,
  },
});

export default VlReferenceCard;
