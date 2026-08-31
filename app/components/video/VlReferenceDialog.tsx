import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Chip, Dialog, Portal, Text} from 'react-native-paper';
import {MAX_REFERENCE_RIR, MIN_REFERENCE_RIR, REFERENCE_RIR_OPTIONS} from '../../utils/velocityLossRir';

interface Props {
  visible: boolean;
  exerciseName: string;
  velocityLossPercent: number;
  /** RIR logged for the linked set, when the analysis is linked to one. */
  reportedRir?: number;
  onConfirm: (rir: number) => void;
  onDismiss: () => void;
}

/**
 * Confirms the RIR that anchors an exercise's VL curve. Only RIR 0–3 are offered:
 * further from failure the velocity signal is too flat to calibrate against.
 */
const VlReferenceDialog = ({visible, exerciseName, velocityLossPercent, reportedRir, onConfirm, onDismiss}: Props) => {
  const defaultRir = reportedRir !== undefined && REFERENCE_RIR_OPTIONS.includes(reportedRir) ? reportedRir : MAX_REFERENCE_RIR;
  const [selectedRir, setSelectedRir] = useState(defaultRir);

  // Re-seed the selection whenever the dialog is opened for a different set.
  useEffect(() => {
    if (visible) {
      setSelectedRir(defaultRir);
    }
  }, [visible, defaultRir]);

  const onPressConfirm = useCallback(() => onConfirm(selectedRir), [onConfirm, selectedRir]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID="vl-reference-dialog">
        <Dialog.Title>Set VL reference</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" testID="vl-reference-dialog-summary">
            {`${exerciseName} · ${velocityLossPercent.toFixed(1)}% VL`}
          </Text>
          <Text variant="bodySmall" style={styles.hint} testID="vl-reference-dialog-hint">
            {`Confirm how many reps were left in the tank on this set. Only RIR ${MIN_REFERENCE_RIR}–${MAX_REFERENCE_RIR} can anchor the curve — further from failure the velocity signal is too flat.`}
          </Text>
          <View style={styles.chipRow}>
            {REFERENCE_RIR_OPTIONS.map((rir) => (
              <Chip
                key={rir}
                testID={`vl-reference-rir-option-${rir}`}
                selected={selectedRir === rir}
                showSelectedCheck
                onPress={() => setSelectedRir(rir)}
              >
                {`RIR ${rir}`}
              </Chip>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="vl-reference-dialog-cancel" onPress={onDismiss}>
            Cancel
          </Button>
          <Button testID="vl-reference-dialog-confirm" mode="contained" onPress={onPressConfirm}>
            {`Anchor at RIR ${selectedRir}`}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  hint: {
    marginTop: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
});

export default VlReferenceDialog;
