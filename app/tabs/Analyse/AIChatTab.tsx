import React, {useEffect, useRef, useState} from 'react';
import {FlatList, KeyboardAvoidingView, Platform, StyleSheet, View} from 'react-native';
import {ActivityIndicator, IconButton, Surface, Text, TextInput, useTheme} from 'react-native-paper';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {appendMessage, clearChat, setError, setLoading, startChatWithContext} from '../../redux/AIChat/aiChatSlice';
import {sendChatMessage, ChatMessage} from '../../utils/ai/sendChatMessage';
import {secureStorage, subscribeToApiKeyChanges} from '../../utils/secureStorage';

const BASE_SYSTEM_PROMPT =
  'You are an AI training coach specializing in powerlifting and strength training. ' +
  'Use the provided analysis context to give specific, actionable advice. ' +
  'Be concise and practical.';

const AIChatTab = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const messages = useSelector((s: GlobalState) => s.aiChat.messages);
  const isLoading = useSelector((s: GlobalState) => s.aiChat.isLoading);
  const error = useSelector((s: GlobalState) => s.aiChat.error);
  const seedContextJson = useSelector((s: GlobalState) => s.aiChat.seedContextJson);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const [hasApiKey, setHasApiKey] = useState(() => {
    try {
      return secureStorage.hasAnthropicApiKey();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const unsub = subscribeToApiKeyChanges(() => {
      try {
        setHasApiKey(secureStorage.hasAnthropicApiKey());
      } catch {
        setHasApiKey(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) {
      return;
    }

    const apiKey = secureStorage.getAnthropicApiKey();
    if (!apiKey) {
      dispatch(setError('No API key configured. Add your Anthropic API key in Settings.'));
      return;
    }

    const userMsg: ChatMessage = {role: 'user', content: text};
    dispatch(appendMessage(userMsg));
    setInputText('');
    dispatch(setLoading(true));
    dispatch(setError(null));

    const systemPrompt = seedContextJson
      ? `${BASE_SYSTEM_PROMPT}\n\nAnalysis context (last 28 days of finished trainings as JSON):\n\n${seedContextJson}`
      : BASE_SYSTEM_PROMPT;

    const history: ChatMessage[] = [...messages, userMsg];
    const result = await sendChatMessage(history, apiKey, systemPrompt);

    if (result.ok) {
      dispatch(appendMessage({role: 'assistant', content: result.text}));
      dispatch(setLoading(false));
    } else {
      dispatch(setError(result.error));
    }
  };

  const handleClear = () => {
    dispatch(clearChat());
    setInputText('');
  };

  const renderMessage = ({item}: {item: ChatMessage}) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.messageBubbleRow,
          isUser ? styles.rowRight : styles.rowLeft,
        ]}
        testID={isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}
      >
        <Surface
          style={[
            styles.bubble,
            {
              backgroundColor: isUser
                ? theme.colors.primary
                : theme.colors.surfaceVariant,
              maxWidth: '80%',
            },
          ]}
          elevation={1}
        >
          <Text
            variant="bodyMedium"
            style={{color: isUser ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}}
            testID={isUser ? 'chat-bubble-user-text' : 'chat-bubble-assistant-text'}
          >
            {item.content}
          </Text>
        </Surface>
      </View>
    );
  };

  if (!hasApiKey) {
    return (
      <View style={[styles.centeredContainer, {backgroundColor: theme.colors.background}]}>
        <Text variant="headlineSmall" style={{color: theme.colors.onSurface, marginBottom: 8}}>
          AI Chat
        </Text>
        <Text
          variant="bodyMedium"
          style={{color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 32}}
          testID="chat-no-key-message"
        >
          Please add your Anthropic API key in Settings to use AI Chat.
        </Text>
      </View>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      {/* Header clear button */}
      <View style={styles.headerRow}>
        <Text variant="titleMedium" style={{color: theme.colors.onSurface, flex: 1}}>
          AI Chat
        </Text>
        <IconButton
          icon="delete-outline"
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={handleClear}
          testID="chat-clear-button"
          disabled={isEmpty && !error}
        />
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        testID="chat-message-list"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text
              variant="bodyMedium"
              style={{color: theme.colors.onSurfaceVariant, textAlign: 'center'}}
              testID="chat-empty-state"
            >
              Start a conversation. You can also open a Training Analysis and tap "Ask AI" to
              pre-load your latest coaching insight.
            </Text>
          </View>
        }
      />

      {/* Loading indicator */}
      {isLoading && (
        <View style={[styles.loadingRow, {backgroundColor: theme.colors.surfaceVariant}]} testID="chat-loading">
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text variant="bodySmall" style={{marginLeft: 8, color: theme.colors.onSurfaceVariant}}>
            AI is thinking…
          </Text>
        </View>
      )}

      {/* Error message */}
      {error && !isLoading && (
        <View style={[styles.errorRow, {backgroundColor: theme.colors.errorContainer}]} testID="chat-error">
          <Text variant="bodySmall" style={{color: theme.colors.onErrorContainer, flex: 1}}>
            {error}
          </Text>
          <IconButton
            icon="close"
            size={16}
            iconColor={theme.colors.onErrorContainer}
            onPress={() => dispatch(setError(null))}
          />
        </View>
      )}

      {/* Input row */}
      <View style={[styles.inputRow, {borderTopColor: theme.colors.outlineVariant}]}>
        <TextInput
          mode="outlined"
          placeholder="Ask a question…"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          disabled={isLoading}
          multiline={false}
          style={styles.textInput}
          testID="chat-input"
          right={
            <TextInput.Icon
              icon="send"
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              testID="chat-send-button"
            />
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  messageBubbleRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
  },
  inputRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
  },
});

export default AIChatTab;
