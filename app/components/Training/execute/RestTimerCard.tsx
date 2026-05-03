import React, {useCallback, useState} from 'react';
import {StyleSheet, TouchableOpacity, Vibration, View} from 'react-native';
import {IconButton, Menu, Text, useTheme} from 'react-native-paper';
import {formatElapsedSecondary, formatTarget, useRestTimer, useVibrationOnRestEvents} from '../../../utils/restTimer';
import RestTargetEditDialog from './RestTargetEditDialog';
import RestProgressRing from './RestProgressRing';

interface RestTimerCardProps {
  startedAt?: number;
  targetSeconds?: number;
  exerciseId?: number;
  onReset: () => void;
  onSkip: () => void;
  onEditTarget: (seconds: number, saveAsDefault: boolean) => void;
  onAdjustExerciseDefault?: (seconds: number) => void;
  exerciseDefaultSeconds?: number;
}

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

  const colors = theme.colors as any;
  const isOverrun = snapshot.state === 'overrun';
  const timerColor = isOverrun ? theme.colors.error : theme.colors.primary;
  const surfaceHigh = colors.surfaceContainerHigh ?? colors.surfaceVariant ?? colors.surface;
  const {onSurface, onSurfaceVariant, primary, error} = theme.colors;

  const elapsedStr = formatElapsedSecondary(targetSeconds!, snapshot.elapsedSeconds);
  const caption = `target ${formatTarget(targetSeconds!)} · elapsed ${elapsedStr}`;

  return (
    <>
      <View testID="rest-timer-card" style={[styles.card, {backgroundColor: surfaceHigh}]}>
        <View style={styles.row}>
          {/* LEFT: animated SVG progress ring with timer text */}
          <TouchableOpacity
            testID="rest-timer-big"
            onPress={() => setEditVisible(true)}
            accessibilityLabel="Rest timer ring">
            <RestProgressRing
              targetSeconds={targetSeconds!}
              elapsedSeconds={snapshot.elapsedSeconds}
              isOverrun={isOverrun}
              trackColor={onSurfaceVariant}
              primaryColor={primary}
              errorColor={error}
              display={snapshot.display}
              textColor={timerColor}
            />
          </TouchableOpacity>

          {/* MIDDLE: Rest label + caption */}
          <View style={styles.middle}>
            <Text style={[styles.restLabel, {color: onSurface}]}>Rest</Text>
            <Text style={[styles.captionLine, {color: onSurfaceVariant}]} testID="rest-timer-elapsed">
              {caption}
            </Text>
          </View>

          {/* RIGHT: Reset pill + overflow menu */}
          <View style={styles.rightCluster}>
            <TouchableOpacity
              testID="rest-timer-reset"
              onPress={onReset}
              style={[styles.resetPill, {borderColor: onSurface}]}>
              <Text style={[styles.resetLabel, {color: onSurface}]}>Reset</Text>
            </TouchableOpacity>
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
    marginTop: 10,
    marginHorizontal: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    minHeight: 70,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  middle: {
    flex: 1,
  },
  restLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  captionLine: {
    fontSize: 11,
    marginTop: 2,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  resetLabel: {
    fontSize: 12,
  },
});

export default RestTimerCard;
