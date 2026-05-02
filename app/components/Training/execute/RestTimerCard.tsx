import React, {useCallback, useState} from 'react';
import {Platform, StyleSheet, TouchableOpacity, Vibration, View} from 'react-native';
import {Button, IconButton, Menu, Text, useTheme} from 'react-native-paper';
import {formatElapsedSecondary, formatTarget, useRestTimer, useVibrationOnRestEvents} from '../../../utils/restTimer';
import RestTargetEditDialog from './RestTargetEditDialog';

interface RestTimerCardProps {
  startedAt?: number;
  targetSeconds?: number;
  exerciseId?: number;
  onReset: () => void;
  onSkip: () => void;
  onEditTarget: (seconds: number, saveAsDefault: boolean) => void;
  // Wired iff the active exercise has an id. Receives the raw seconds value
  // from the dialog and is expected to persist the per-exercise default.
  onAdjustExerciseDefault?: (seconds: number) => void;
  // Pre-fill value for the "Adjust default for this exercise" dialog —
  // resolved by the parent (per-exercise default → user default → 90s).
  exerciseDefaultSeconds?: number;
}

const monoFamily = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

const RestTimerCard = ({
  startedAt,
  targetSeconds,
  exerciseId,
  onReset,
  onSkip,
  onEditTarget,
  onAdjustExerciseDefault,
  exerciseDefaultSeconds,
}: RestTimerCardProps) => {
  const theme = useTheme();
  const enabled = !!startedAt && !!targetSeconds && targetSeconds > 0;
  const snapshot = useRestTimer({startedAt, targetSeconds, enabled});
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [exerciseDefaultDialogVisible, setExerciseDefaultDialogVisible] = useState(false);

  const vibrate = useCallback((duration: number) => {
    Vibration.vibrate(duration);
  }, []);
  useVibrationOnRestEvents(snapshot, enabled, vibrate);

  if (!enabled) return null;

  const tint = snapshot.state === 'overrun' ? theme.colors.error : theme.colors.primary;
  const surfaceContainer = (theme.colors as any).surfaceVariant ?? theme.colors.surface;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;
  const secondaryContainer = (theme.colors as any).secondaryContainer ?? theme.colors.surface;
  const onSecondaryContainer = (theme.colors as any).onSecondaryContainer ?? theme.colors.onSurface;
  const secondary = (theme.colors as any).secondary ?? theme.colors.onSurfaceVariant;

  return (
    <>
      <View testID="rest-timer-card" style={[styles.card, {backgroundColor: surfaceContainer}]}>
        <View style={styles.headerRow}>
          <Text style={[styles.header, {color: onSurfaceVariant}]}>REST</Text>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                testID="rest-timer-overflow"
                icon="dots-vertical"
                size={20}
                onPress={() => setMenuVisible(true)}
              />
            }>
            <Menu.Item
              testID="rest-timer-skip"
              onPress={() => {
                setMenuVisible(false);
                onSkip();
              }}
              title="Skip rest"
            />
            <Menu.Item
              testID="rest-timer-edit-target-menu"
              onPress={() => {
                setMenuVisible(false);
                setEditVisible(true);
              }}
              title="Edit target…"
            />
            {onAdjustExerciseDefault && (
              <Menu.Item
                testID="rest-timer-adjust-default"
                onPress={() => {
                  setMenuVisible(false);
                  setExerciseDefaultDialogVisible(true);
                }}
                title="Adjust default for this exercise"
              />
            )}
          </Menu>
        </View>
        <View style={styles.bodyRow}>
          <TouchableOpacity onPress={() => setEditVisible(true)} testID="rest-timer-big">
            <Text style={[styles.bigTimer, {color: tint, fontFamily: monoFamily}]}>{snapshot.display}</Text>
          </TouchableOpacity>
          <View style={styles.rightStack}>
            <Text style={[styles.targetLabel, {color: onSurfaceVariant, fontFamily: monoFamily}]}>
              target {formatTarget(targetSeconds!)}
            </Text>
            <Text style={[styles.elapsedLabel, {color: secondary, fontFamily: monoFamily}]} testID="rest-timer-elapsed">
              elapsed {formatElapsedSecondary(targetSeconds!, snapshot.elapsedSeconds)}
            </Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Button
            testID="rest-timer-reset"
            mode="contained"
            buttonColor={secondaryContainer}
            textColor={onSecondaryContainer}
            onPress={onReset}
            style={styles.resetButton}
            compact>
            Reset
          </Button>
        </View>
      </View>
      <RestTargetEditDialog
        visible={editVisible}
        initialSeconds={targetSeconds!}
        onCancel={() => setEditVisible(false)}
        onSave={(seconds, saveAsDefault) => {
          setEditVisible(false);
          onEditTarget(seconds, saveAsDefault);
        }}
      />
      <RestTargetEditDialog
        visible={exerciseDefaultDialogVisible}
        mode="exerciseDefault"
        initialSeconds={exerciseDefaultSeconds ?? targetSeconds!}
        onCancel={() => setExerciseDefaultDialogVisible(false)}
        onSave={(seconds) => {
          setExerciseDefaultDialogVisible(false);
          onAdjustExerciseDefault?.(seconds);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
    padding: 12,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  bigTimer: {
    fontSize: 36,
    fontWeight: '600',
  },
  rightStack: {
    alignItems: 'flex-end',
  },
  targetLabel: {
    fontSize: 13,
  },
  elapsedLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButton: {
    borderRadius: 16,
  },
});

export default RestTimerCard;
