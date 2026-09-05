import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Button, Dialog, List, Portal, Text, useTheme} from 'react-native-paper';
import {SelectableTraining} from '../../utils/ai/chatPlanningContext';

interface ChatTrainingPickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  trainings: SelectableTraining[];
  selectedId: number | null;
  /** `null` clears the subject again. */
  onSelect: (id: number | null) => void;
}

const STATE_TEXT: Record<SelectableTraining['state'], string> = {
  planned: 'planned',
  started: 'running',
  finished: 'trained',
};

/**
 * GH-391 — pick the ONE training the conversation is about. Planned sessions of
 * the current and next micro come first, then the most recent finished ones, so
 * both kinds are reachable without scrolling through the whole history.
 */
const ChatTrainingPickerDialog = ({
  visible,
  onDismiss,
  trainings,
  selectedId,
  onSelect,
}: ChatTrainingPickerDialogProps) => {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID="chat-training-picker">
        <Dialog.Title>
          <Text variant="titleMedium">Talk about one training</Text>
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView testID="chat-training-picker-list">
            <List.Item
              title="No single training"
              description="Use the general context only"
              testID="chat-training-option-none"
              onPress={() => onSelect(null)}
              right={props => (selectedId == null ? <List.Icon {...props} icon="check" /> : null)}
            />
            {trainings.length === 0 ? (
              <Text
                variant="bodySmall"
                style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}
                testID="chat-training-picker-empty"
              >
                No trainings to choose from yet.
              </Text>
            ) : (
              trainings.map(training => (
                <List.Item
                  key={training.id}
                  title={training.label}
                  description={training.date ? `${STATE_TEXT[training.state]} · ${training.date}` : STATE_TEXT[training.state]}
                  testID={`chat-training-option-${training.id}`}
                  onPress={() => onSelect(training.id)}
                  right={props => (selectedId === training.id ? <List.Icon {...props} icon="check" /> : null)}
                />
              ))
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID="chat-training-picker-close">
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    paddingHorizontal: 0,
    maxHeight: 400,
  },
  emptyText: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});

export default ChatTrainingPickerDialog;
