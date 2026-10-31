import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Switch, Text, useTheme} from 'react-native-paper';
import {RecoveryContext} from '../../redux/HealthConnect/use/useRecoveryContext';

interface ChatRecoveryOptionProps {
  recovery: RecoveryContext;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const recoveryInfoText = (recovery: RecoveryContext, enabled: boolean): string => {
  if (!enabled) return 'Sleep and steps from Health Connect are not sent.';
  if (recovery.error && recovery.dayCount === 0) return `Could not read Health Connect: ${recovery.error}`;
  if (recovery.dayCount === 0) return 'Sleep and steps attached: no data in this period';
  return `Sleep and steps attached: ${recovery.dayCount} day${recovery.dayCount !== 1 ? 's' : ''}`;
};

/**
 * GH-619: opt-in for the recovery section of the chat context. The switch only exists while
 * Health Connect may read sleep or steps; otherwise a hint says why it is missing.
 */
const ChatRecoveryOption = ({recovery, enabled, onToggle}: ChatRecoveryOptionProps) => {
  const theme = useTheme();

  if (!recovery.available) {
    return (
      <Text variant="bodySmall" style={[styles.text, {color: theme.colors.onSurfaceVariant}]} testID="chat-recovery-hint">
        {recovery.hint}
      </Text>
    );
  }

  return (
    <View style={styles.row} testID="chat-recovery-option">
      <View style={styles.rowText}>
        <Text variant="bodyMedium">Include sleep and steps</Text>
        <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="chat-recovery-info">
          {recoveryInfoText(recovery, enabled)}
        </Text>
      </View>
      <Switch value={enabled} onValueChange={onToggle} testID="chat-recovery-switch" />
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  rowText: {
    flex: 1,
    marginRight: 10,
  },
});

export default memo(ChatRecoveryOption);
