/**
 * GH-293: overview of archived AI chat conversations.
 * Entries (title, date, snippet) come from Redux; the full messages live in
 * JSON files on disk. Search covers the full message contents: files are read
 * on demand and cached per entry while this screen is open.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {Divider, IconButton, Searchbar, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {GlobalState} from '../../redux/rootReducer';
import {ChatHistoryEntry, removeHistoryEntry, setActiveMessages} from '../../redux/AIChat/aiChatSlice';
import {useArchiveActiveChat} from '../../redux/AIChat/use/useArchiveActiveChat';
import {
  deleteChatFile,
  historyEntryMatchesQuery,
  messagesToSearchText,
  readChatFile,
} from '../../utils/ai/chatHistoryStorage';

function formatEntryDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ChatHistoryTab = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const history = useSelector((s: GlobalState) => s.aiChat.history);
  const archiveActiveChat = useArchiveActiveChat();

  const [query, setQuery] = useState('');
  // Lower-cased full chat text per entry id, loaded lazily for full-content search.
  const [fullTexts, setFullTexts] = useState<Record<string, string>>({});
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Load the chat files of all entries whose text is not cached yet as soon as
  // the user searches, so a hit in the middle of a conversation is found.
  useEffect(() => {
    if (query.trim() === '') return;
    const missing = history.filter(e => fullTexts[e.id] === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const loaded: Record<string, string> = {};
      for (const entry of missing) {
        try {
          loaded[entry.id] = messagesToSearchText(await readChatFile(entry.fileName));
        } catch {
          loaded[entry.id] = '';
        }
      }
      if (!cancelled) {
        setFullTexts(prev => ({...prev, ...loaded}));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, history, fullTexts]);

  const filtered = useMemo(
    () => history.filter(entry => historyEntryMatchesQuery(entry, fullTexts[entry.id], query)),
    [history, fullTexts, query],
  );

  const handleOpen = useCallback(
    async (entry: ChatHistoryEntry) => {
      if (openingId) return;
      setOpeningId(entry.id);
      try {
        const messages = await readChatFile(entry.fileName);
        // Archive the running chat first so it is never lost, then un-archive
        // the selected conversation into the active chat (entry + file go away
        // so the conversation exists exactly once).
        await archiveActiveChat();
        dispatch(setActiveMessages(messages));
        dispatch(removeHistoryEntry(entry.id));
        await deleteChatFile(entry.fileName);
        navigation.navigate('AIChat');
      } catch {
        // Chat file unreadable — keep the entry so the user can retry.
      } finally {
        setOpeningId(null);
      }
    },
    [openingId, archiveActiveChat, dispatch, navigation],
  );

  const handleDelete = useCallback(
    async (entry: ChatHistoryEntry) => {
      try {
        await deleteChatFile(entry.fileName);
      } catch {
        // File deletion failed — still remove the entry; deleteChatFile treats
        // missing files as deleted, so this only hits on real I/O errors.
      }
      dispatch(removeHistoryEntry(entry.id));
    },
    [dispatch],
  );

  const renderEntry = ({item}: {item: ChatHistoryEntry}) => (
    <TouchableRipple onPress={() => handleOpen(item)} testID={`chat-history-entry-${item.id}`}>
      <View style={styles.entryRow}>
        <View style={styles.entryTextColumn}>
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={{color: theme.colors.onSurface}}
            testID="chat-history-entry-title"
          >
            {item.title}
          </Text>
          <Text
            variant="labelSmall"
            style={{color: theme.colors.onSurfaceVariant}}
            testID="chat-history-entry-date"
          >
            {`${formatEntryDate(item.createdAt)} · ${item.messageCount} message${item.messageCount !== 1 ? 's' : ''}`}
          </Text>
          {item.snippet !== '' && (
            <Text
              variant="bodySmall"
              numberOfLines={2}
              style={{color: theme.colors.onSurfaceVariant}}
              testID="chat-history-entry-snippet"
            >
              {item.snippet}
            </Text>
          )}
        </View>
        <IconButton
          icon="delete-outline"
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => handleDelete(item)}
          testID={`chat-history-delete-${item.id}`}
        />
      </View>
    </TouchableRipple>
  );

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Searchbar
        placeholder="Search chats"
        value={query}
        onChangeText={setQuery}
        style={styles.searchBar}
        testID="chat-history-search"
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderEntry}
        ItemSeparatorComponent={Divider}
        testID="chat-history-list"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text
              variant="bodyMedium"
              style={{color: theme.colors.onSurfaceVariant, textAlign: 'center'}}
              testID="chat-history-empty"
            >
              {history.length === 0
                ? 'No archived chats yet. Clearing the AI chat or starting a new one moves the conversation here.'
                : 'No chats match your search.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 10,
  },
  entryTextColumn: {
    flex: 1,
    gap: 2,
  },
  emptyContainer: {
    paddingTop: 48,
    paddingHorizontal: 32,
  },
});

export default ChatHistoryTab;
