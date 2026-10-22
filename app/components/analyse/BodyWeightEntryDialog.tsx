import React, {useEffect, useState} from 'react';
import {StyleSheet} from 'react-native';
import {HelperText, TextInput} from 'react-native-paper';
import EditDialogScaffold from '../common/EditDialogScaffold';
import {BodyWeightEntry} from '../../models/entities/BodyWeightEntry';
import {BodyWeightDraft, draftToBodyWeightEntry, formatBodyWeightDate, validateBodyWeightDraft} from '../../utils/body-weight';

interface BodyWeightEntryDialogProps {
  visible: boolean;
  /** The entry to edit; `undefined` creates a new one. */
  entry?: BodyWeightEntry;
  onDismiss: () => void;
  onSave: (entry: Omit<BodyWeightEntry, 'id'>) => void;
  onDelete?: () => void;
}

const createDraft = (entry?: BodyWeightEntry): BodyWeightDraft => ({
  date: formatBodyWeightDate(entry?.date ?? Date.now()),
  weight: entry ? String(entry.weightKg) : '',
  note: entry?.note ?? '',
});

const BodyWeightEntryDialog = ({visible, entry, onDismiss, onSave, onDelete}: BodyWeightEntryDialogProps) => {
  const [draft, setDraft] = useState<BodyWeightDraft>(() => createDraft(entry));
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(createDraft(entry));
      setShowErrors(false);
    }
  }, [visible, entry]);

  const errors = validateBodyWeightDraft(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    onSave(draftToBodyWeightEntry(draft));
  };

  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onDismiss}
      title={entry ? 'Edit weight' : 'Add weight'}
      testID="body-weight-dialog"
      dismissTestID="body-weight-dialog-close"
      primaryAction={{label: 'Save', onPress: handleSave, testID: 'body-weight-save'}}
      destructiveAction={
        entry && onDelete
          ? {
              label: 'Delete entry',
              onConfirm: onDelete,
              confirmTitle: 'Delete weight entry?',
              confirmMessage: 'This entry is removed from the weight history.',
              testID: 'body-weight-delete',
              confirmTestID: 'body-weight-delete-confirm',
            }
          : undefined
      }
      scrollable
    >
      <TextInput
        mode="outlined"
        label="Date (YYYY-MM-DD)"
        value={draft.date}
        onChangeText={(date) => setDraft((current) => ({...current, date}))}
        error={showErrors && !!errors.date}
        autoCorrect={false}
        testID="body-weight-date-input"
      />
      <HelperText type="error" visible={showErrors && !!errors.date} testID="body-weight-date-error">
        {errors.date}
      </HelperText>
      <TextInput
        mode="outlined"
        label="Weight (kg)"
        value={draft.weight}
        onChangeText={(weight) => setDraft((current) => ({...current, weight}))}
        keyboardType="decimal-pad"
        error={showErrors && !!errors.weight}
        testID="body-weight-weight-input"
      />
      <HelperText type="error" visible={showErrors && !!errors.weight} testID="body-weight-weight-error">
        {errors.weight}
      </HelperText>
      <TextInput
        mode="outlined"
        label="Note (optional)"
        value={draft.note}
        onChangeText={(note) => setDraft((current) => ({...current, note}))}
        error={showErrors && !!errors.note}
        style={styles.note}
        testID="body-weight-note-input"
      />
      <HelperText type="error" visible={showErrors && !!errors.note}>
        {errors.note}
      </HelperText>
    </EditDialogScaffold>
  );
};

const styles = StyleSheet.create({
  note: {
    marginTop: 0,
  },
});

export default BodyWeightEntryDialog;
