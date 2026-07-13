import React, {useState} from 'react';
import {Dimensions, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Dialog, IconButton, Portal, Text, useTheme} from 'react-native-paper';

/**
 * Shared visual scaffold for all edit/config pop-ups (GH-339).
 *
 * Mirrors the Edit Exercise screen pattern inside a Paper Dialog:
 * header row with close on the left and the primary action (Save/Apply)
 * on the right, sectioned content with outlined inputs, and destructive
 * actions in the error color behind a confirmation step.
 */

export interface EditDialogAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: string;
  testID?: string;
}

export interface EditDialogDestructiveAction {
  label: string;
  onConfirm: () => void;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  testID?: string;
  confirmTestID?: string;
  cancelTestID?: string;
  dialogTestID?: string;
}

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
  confirmTestID?: string;
  cancelTestID?: string;
}

export const ConfirmDialog = ({visible, title, message, confirmLabel, onConfirm, onCancel, testID, confirmTestID, cancelTestID}: ConfirmDialogProps) => {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel} testID={testID}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} testID={cancelTestID}>
            Cancel
          </Button>
          <Button onPress={onConfirm} textColor={theme.colors.error} testID={confirmTestID}>
            {confirmLabel ?? 'Delete'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export const EditDialogSectionLabel = ({children}: {children: React.ReactNode}) => {
  const theme = useTheme();

  return (
    <Text variant="labelMedium" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
      {children}
    </Text>
  );
};

interface EditDialogScaffoldProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
  dismissTestID?: string;
  primaryAction?: EditDialogAction;
  secondaryActions?: EditDialogAction[];
  destructiveAction?: EditDialogDestructiveAction;
  scrollable?: boolean;
  maxHeightRatio?: number;
}

const EditDialogScaffold = ({
  visible,
  onDismiss,
  title,
  children,
  testID,
  dismissTestID,
  primaryAction,
  secondaryActions,
  destructiveAction,
  scrollable,
  maxHeightRatio,
}: EditDialogScaffoldProps) => {
  const theme = useTheme();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const screenHeight = Dimensions.get('window').height;
  const dialogMaxHeight = screenHeight * (maxHeightRatio ?? 0.9);

  const footer = (secondaryActions?.length || destructiveAction) && (
    <View style={styles.footer}>
      {secondaryActions?.map((action) => (
        <Button key={action.label} mode="text" icon={action.icon} onPress={action.onPress} disabled={action.disabled} testID={action.testID} style={styles.footerButton}>
          {action.label}
        </Button>
      ))}
      {destructiveAction && (
        <Button
          mode="outlined"
          onPress={() => setConfirmVisible(true)}
          textColor={theme.colors.error}
          testID={destructiveAction.testID}
          style={styles.footerButton}
        >
          {destructiveAction.label}
        </Button>
      )}
    </View>
  );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{maxHeight: dialogMaxHeight}} testID={testID}>
        <View style={styles.header}>
          <IconButton icon="close" onPress={onDismiss} testID={dismissTestID} accessibilityLabel={`Close ${title}`} style={styles.headerClose} />
          <Text variant="titleLarge" numberOfLines={1} style={[styles.headerTitle, {color: theme.colors.onSurface}]}>
            {title}
          </Text>
          {primaryAction && (
            <Button mode="text" onPress={primaryAction.onPress} disabled={primaryAction.disabled} testID={primaryAction.testID}>
              {primaryAction.label}
            </Button>
          )}
        </View>
        {scrollable ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
            {footer}
          </ScrollView>
        ) : (
          <View style={styles.content}>
            {children}
            {footer}
          </View>
        )}
      </Dialog>
      {destructiveAction && (
        <ConfirmDialog
          visible={confirmVisible}
          title={destructiveAction.confirmTitle}
          message={destructiveAction.confirmMessage}
          confirmLabel={destructiveAction.confirmLabel}
          onConfirm={() => {
            setConfirmVisible(false);
            destructiveAction.onConfirm();
          }}
          onCancel={() => setConfirmVisible(false)}
          testID={destructiveAction.dialogTestID}
          confirmTestID={destructiveAction.confirmTestID}
          cancelTestID={destructiveAction.cancelTestID}
        />
      )}
    </Portal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 8,
  },
  headerClose: {
    margin: 0,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 4,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  footer: {
    marginTop: 16,
    gap: 8,
  },
  footerButton: {
    alignSelf: 'stretch',
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default EditDialogScaffold;
