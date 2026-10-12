import React, {useSyncExternalStore} from 'react';
import {StyleSheet, View} from 'react-native';
import {IconButton, useTheme} from 'react-native-paper';

/**
 * GH-508: history, filter and clear of the AI Chat sit in the navigation header
 * next to its "AI Chat" title, instead of in a second title row inside the
 * screen that repeated the title and cost the message list a row of height.
 *
 * The header is registered once in the AnalyseRouter options. Setting it from
 * the screen with `navigation.setOptions` re-rendered the whole drawer navigator
 * while the drawer was closing after "AI Chat" was picked, which left the drawer
 * stuck open over the chat. The screen therefore publishes what the buttons need
 * through this small store instead of through the navigation options.
 */
interface AIChatHeaderState {
  /** False while the screen shows its "add your API key" placeholder or is not mounted. */
  visible: boolean;
  filtersOpen: boolean;
  clearDisabled: boolean;
  onToggleFilters: () => void;
  onClear: () => void;
}

const HIDDEN: AIChatHeaderState = {
  visible: false,
  filtersOpen: false,
  clearDisabled: true,
  onToggleFilters: () => {},
  onClear: () => {},
};

let headerState = HIDDEN;
const listeners = new Set<() => void>();

export function publishAIChatHeaderState(next: AIChatHeaderState | null) {
  headerState = next ?? HIDDEN;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => headerState;

const AIChatHeaderActions = ({onOpenHistory}: {onOpenHistory: () => void}) => {
  const theme = useTheme();
  const state = useSyncExternalStore(subscribe, getSnapshot);
  if (!state.visible) return null;

  return (
    <View style={styles.headerActions} testID="chat-header-actions">
      <IconButton
        icon="history"
        size={20}
        style={styles.headerAction}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={onOpenHistory}
        testID="chat-history-button"
      />
      <IconButton
        icon={state.filtersOpen ? 'filter-remove-outline' : 'filter-outline'}
        size={20}
        style={styles.headerAction}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={state.onToggleFilters}
        testID="chat-filter-toggle"
      />
      <IconButton
        icon="delete-outline"
        size={20}
        style={styles.headerAction}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={state.onClear}
        testID="chat-clear-button"
        disabled={state.clearDisabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  headerAction: {
    marginHorizontal: 0,
  },
});

export default AIChatHeaderActions;
