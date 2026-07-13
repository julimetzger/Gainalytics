import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Checkbox, Text, TextInput} from 'react-native-paper';
import EditDialogScaffold from '../../common/EditDialogScaffold';

interface RestTargetEditDialogProps {
  visible: boolean;
  initialSeconds: number;
  onCancel: () => void;
  onSave: (seconds: number, saveAsDefault: boolean) => void;
  // 'adhoc' (default) shows the "Save as default" checkbox.
  // 'exerciseDefault' is the entry mode for "Adjust default for this exercise"
  // — the per-exercise default is always persisted (checkbox hidden).
  mode?: 'adhoc' | 'exerciseDefault';
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const RestTargetEditDialog = ({visible, initialSeconds, onCancel, onSave, mode = 'adhoc'}: RestTargetEditDialogProps) => {
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const isExerciseDefaultMode = mode === 'exerciseDefault';

  useEffect(() => {
    if (visible) {
      const m = Math.floor(Math.max(0, initialSeconds) / 60);
      const s = Math.max(0, initialSeconds) % 60;
      setMinutes(String(m));
      setSeconds(String(s).padStart(2, '0'));
      setSaveAsDefault(false);
    }
  }, [visible, initialSeconds]);

  const onSubmit = () => {
    const m = clamp(parseInt(minutes, 10) || 0, 0, 59);
    const s = clamp(parseInt(seconds, 10) || 0, 0, 59);
    const total = m * 60 + s;
    if (total <= 0) {
      onCancel();
      return;
    }
    onSave(total, isExerciseDefaultMode ? true : saveAsDefault);
  };

  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onCancel}
      title={isExerciseDefaultMode ? 'Adjust default rest' : 'Edit rest target'}
      testID="rest-target-edit-dialog"
      dismissTestID="rest-target-cancel"
      primaryAction={{label: 'Save', onPress: onSubmit, testID: 'rest-target-save'}}
    >
      <View style={styles.inputRow}>
        <TextInput
          testID="rest-target-minutes"
          label="min"
          mode="outlined"
          keyboardType="numeric"
          value={minutes}
          onChangeText={(v) => setMinutes(v.replace(/[^0-9]/g, '').slice(0, 2))}
          style={styles.input}
        />
        <Text style={styles.separator}>:</Text>
        <TextInput
          testID="rest-target-seconds"
          label="sec"
          mode="outlined"
          keyboardType="numeric"
          value={seconds}
          onChangeText={(v) => setSeconds(v.replace(/[^0-9]/g, '').slice(0, 2))}
          style={styles.input}
        />
      </View>
      {isExerciseDefaultMode ? (
        <Text testID="rest-target-exercise-default-hint" style={styles.hintLabel}>
          Saved as default for this exercise.
        </Text>
      ) : (
        <View style={styles.checkRow}>
          <Checkbox
            testID="rest-target-save-default"
            status={saveAsDefault ? 'checked' : 'unchecked'}
            onPress={() => setSaveAsDefault((v) => !v)}
          />
          <Text style={styles.checkLabel}>Save as default for this exercise</Text>
        </View>
      )}
    </EditDialogScaffold>
  );
};

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: 80,
  },
  separator: {
    fontSize: 24,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
  },
  hintLabel: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.7,
  },
});

export default RestTargetEditDialog;
