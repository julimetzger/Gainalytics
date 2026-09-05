import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Dialog, Portal, Text, useTheme} from 'react-native-paper';
import {ChatContextSection} from '../../utils/ai/buildChatContext';

/**
 * A single Text node of ~10 000 characters breaks the enclosing ScrollView's
 * content height on Android — the scroll simply stops inside it and everything
 * below becomes unreachable. Each section is therefore shown up to this many
 * characters; the full text is still what gets sent, and the header states the
 * real size.
 */
const PREVIEW_CHARS = 4000;

const previewOf = (json: string): string =>
  json.length <= PREVIEW_CHARS
    ? json
    : `${json.slice(0, PREVIEW_CHARS)}\n… (+${json.length - PREVIEW_CHARS} more characters — all of it is sent)`;

interface ChatContextPreviewDialogProps {
  visible: boolean;
  onDismiss: () => void;
  sections: ChatContextSection[];
  /** Characters of the context block that is actually sent. */
  size: number;
}

/**
 * GH-391 — makes the context the chat receives readable inside the app.
 *
 * The sections come from the same builder that assembles the system prompt, so
 * whatever is missing here is missing from the prompt too. Nothing about the
 * API key is ever part of this — the dialog only ever sees training data.
 */
const ChatContextPreviewDialog = ({visible, onDismiss, sections, size}: ChatContextPreviewDialogProps) => {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID="chat-context-preview-dialog">
        <Dialog.Title>
          <Text variant="titleMedium">Context sent to the AI</Text>
        </Dialog.Title>
        <Dialog.Content>
          <Text
            variant="labelSmall"
            style={{color: theme.colors.onSurfaceVariant}}
            testID="chat-context-preview-size"
          >
            {`${sections.length} section${sections.length !== 1 ? 's' : ''} · ${size} characters`}
          </Text>
        </Dialog.Content>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} testID="chat-context-preview-scroll">
            {sections.length === 0 ? (
              <Text
                variant="bodySmall"
                style={{color: theme.colors.onSurfaceVariant}}
                testID="chat-context-preview-empty"
              >
                No context attached — the AI answers without training data.
              </Text>
            ) : (
              sections.map(section => (
                <View key={section.key} style={styles.section}>
                  <Text
                    variant="labelMedium"
                    style={{color: theme.colors.primary}}
                    testID={`chat-context-preview-title-${section.key}`}
                  >
                    {section.title}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={[styles.json, {color: theme.colors.onSurface}]}
                    testID={`chat-context-preview-${section.key}`}
                    selectable
                  >
                    {previewOf(section.json)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID="chat-context-preview-close">
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
    maxHeight: 380,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  section: {
    marginBottom: 16,
  },
  json: {
    marginTop: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 15,
  },
});

export default ChatContextPreviewDialog;
