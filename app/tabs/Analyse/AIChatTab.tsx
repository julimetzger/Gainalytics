import React, {useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, KeyboardAvoidingView, ScrollView, StyleSheet, View} from 'react-native';
import {ActivityIndicator, Chip, IconButton, Surface, Text, TextInput, useTheme} from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import {aiChatMarkdownStyles} from './aiChatMarkdownStyles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useHeaderHeight} from '@react-navigation/elements';
import {useNavigation} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../redux/rootReducer';
import {
  appendMessage,
  clearChat,
  setError,
  setLoading,
  setSeedContextJson,
  setContextRange,
  setIncludePlannedTrainings,
  setSelectedTrainingId,
  setPendingLegacyArchive,
  ContextRange,
} from '../../redux/AIChat/aiChatSlice';
import {selectAllFinishedTrainings} from '../../redux/AIChat/selectors';
import {useArchiveActiveChat} from '../../redux/AIChat/use/useArchiveActiveChat';
import {sendChatMessage, ChatMessage} from '../../utils/ai/sendChatMessage';
import {secureStorage, subscribeToApiKeyChanges} from '../../utils/secureStorage';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {serializeTrainingsForChat} from '../../utils/ai/serializeTrainingsForChat';
import {filterTrainingsByDateRange} from '../../utils/ai/filterTrainingsByDateRange';
import {Training} from '../../models/entities/Training';
import {TrainingsState} from '../../models/TrainingsState';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {getMesoEndMicro, getMesoForMicro, getMicroFromTrainingInMicroIndex} from '../../redux/Training/trainingsPlanReducer';
import {
  buildPlannedTrainingsContext,
  buildSelectedTrainingContext,
  buildTrainingLocators,
  listChatSelectableTrainings,
} from '../../utils/ai/chatPlanningContext';
import {
  buildChatSystemPrompt,
  chatContextSections,
  chatContextSize,
  ChatContextParts,
} from '../../utils/ai/buildChatContext';
import ChatContextPreviewDialog from '../../components/ai/ChatContextPreviewDialog';
import ChatTrainingPickerDialog from '../../components/ai/ChatTrainingPickerDialog';
import {useAIChatPrompt} from '../../redux/settings/use/useAIChatPrompt';
import {useAnthropicModel} from '../../redux/settings/use/useAnthropicModel';

type Preset = '7d' | '28d' | '3M' | 'Meso' | 'Custom';

interface MesoRange {
  start: Date;
  end: Date;
  name: string;
}

function makeRange(days: number): Range {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  return new Range(start, end);
}

function toContextRange(range: Range): ContextRange {
  return {startDate: range.startDate.toISOString(), endDate: range.endDate.toISOString()};
}

function fromContextRange(cr: ContextRange): Range {
  return new Range(new Date(cr.startDate), new Date(cr.endDate));
}

function formatDateISO(date: Date): string {
  return date.toISOString().substring(0, 10);
}

export function computeMesoRange(
  plans: TrainingsPlan[],
  trainingsById: Record<number, Training>,
): MesoRange | null {
  let latestTime = 0;
  let bestPlan: TrainingsPlan | null = null;
  let bestMicro = 0;

  for (const plan of plans) {
    for (const [key, trainingId] of Object.entries(plan.trainings ?? {})) {
      const t = trainingsById[trainingId as number];
      if (t?.state === TrainingsState.FINISHED && t.end) {
        const ms = new Date(t.end).getTime();
        if (ms > latestTime) {
          latestTime = ms;
          bestPlan = plan;
          bestMicro = getMicroFromTrainingInMicroIndex(key);
        }
      }
    }
  }

  if (!bestPlan || !bestMicro) return null;
  const meso = getMesoForMicro(bestPlan.mesos, bestMicro);
  if (!meso) return null;

  const mesoEndMicro = getMesoEndMicro(bestPlan.mesos, meso) ?? Infinity;

  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const [key, trainingId] of Object.entries(bestPlan.trainings ?? {})) {
    const micro = getMicroFromTrainingInMicroIndex(key);
    if (micro < meso.startMicro || micro > mesoEndMicro) continue;
    const t = trainingsById[trainingId as number];
    if (t?.state === TrainingsState.FINISHED && t.start && t.end) {
      const s = new Date(t.start).getTime();
      const e = new Date(t.end).getTime();
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
    }
  }

  if (!isFinite(minStart) || !isFinite(maxEnd)) return null;
  return {start: new Date(minStart), end: new Date(maxEnd), name: meso.name};
}

const AIChatTab = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const chatPrompt = useAIChatPrompt();
  const model = useAnthropicModel();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const archiveActiveChat = useArchiveActiveChat();

  const messages = useSelector((s: GlobalState) => s.aiChat.messages);
  const isLoading = useSelector((s: GlobalState) => s.aiChat.isLoading);
  const error = useSelector((s: GlobalState) => s.aiChat.error);
  const seedContextJson = useSelector((s: GlobalState) => s.aiChat.seedContextJson);
  const contextRange = useSelector((s: GlobalState) => s.aiChat.contextRange);
  const pendingLegacyArchive = useSelector((s: GlobalState) => s.aiChat.pendingLegacyArchive);
  // GH-391 — undefined only until migration 13 has run on a very old store.
  const includePlanned = useSelector((s: GlobalState) => s.aiChat.includePlannedTrainings ?? true);
  const selectedTrainingId = useSelector((s: GlobalState) => s.aiChat.selectedTrainingId ?? null);

  const trainingsById = useSelector((s: GlobalState) => s.trainings.byId);
  const workoutsById = useSelector((s: GlobalState) => s.workouts.byId) as Record<number, any>;
  const exercisesById = useSelector((s: GlobalState) => s.exercises.byId) as Record<number, any>;
  const videoAnalysesById = useSelector((s: GlobalState) => s.videoAnalyses.byId) as Record<number, any>;
  const trainingsPlanById = useSelector((s: GlobalState) => s.trainingsPlan.byId);
  const trainingsPlanAllIds = useSelector((s: GlobalState) => s.trainingsPlan.allIds);
  const allFinishedTrainings = useSelector(selectAllFinishedTrainings);

  const [inputText, setInputText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<Preset>('28d');
  const [showFilters, setShowFilters] = useState(false);
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [showTrainingPicker, setShowTrainingPicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<any>(null);

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

  const allPlans = useMemo(
    () =>
      (trainingsPlanAllIds as number[])
        .map(id => (trainingsPlanById as Record<number, TrainingsPlan>)[id])
        .filter(Boolean) as TrainingsPlan[],
    [trainingsPlanAllIds, trainingsPlanById],
  );

  const mesoRange = useMemo(
    () => computeMesoRange(allPlans, trainingsById as Record<number, Training>),
    [allPlans, trainingsById],
  );

  const effectiveRange = useMemo(
    () => (contextRange ? fromContextRange(contextRange) : makeRange(28)),
    [contextRange],
  );

  // On mount: initialise selectedPreset from persisted contextRange
  useEffect(() => {
    if (!contextRange) {
      setSelectedPreset('28d');
      return;
    }
    const range = fromContextRange(contextRange);
    const diffDays = Math.round(
      (range.endDate.getTime() - range.startDate.getTime()) / (24 * 3600 * 1000),
    );
    const endIsToday =
      new Date().toISOString().substring(0, 10) === range.endDate.toISOString().substring(0, 10);
    if (endIsToday && diffDays >= 6 && diffDays <= 8) {
      setSelectedPreset('7d');
    } else if (endIsToday && diffDays >= 27 && diffDays <= 29) {
      setSelectedPreset('28d');
    } else if (endIsToday && diffDays >= 88 && diffDays <= 92) {
      setSelectedPreset('3M');
    } else {
      setSelectedPreset('Custom');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-seed seedContextJson whenever contextRange or training/workout/exercise data changes.
  useEffect(() => {
    const range = contextRange ? fromContextRange(contextRange) : makeRange(28);
    const filtered = filterTrainingsByDateRange(allFinishedTrainings, range.startDate, range.endDate);
    const json = serializeTrainingsForChat(filtered, workoutsById, exercisesById, videoAnalysesById);
    dispatch(setSeedContextJson(json));
  }, [contextRange, allFinishedTrainings, workoutsById, exercisesById, videoAnalysesById, dispatch]);

  const filteredCount = useMemo(
    () =>
      filterTrainingsByDateRange(
        allFinishedTrainings,
        effectiveRange.startDate,
        effectiveRange.endDate,
      ).length,
    [allFinishedTrainings, effectiveRange],
  );

  // GH-391 — the planning half of the context. Null whenever there is genuinely
  // nothing planned, so no empty placeholder session can reach the prompt.
  const plannedContext = useMemo(
    () =>
      buildPlannedTrainingsContext(
        allPlans,
        trainingsById as Record<number, Training>,
        workoutsById,
        exercisesById,
      ),
    [allPlans, trainingsById, workoutsById, exercisesById],
  );

  const selectableTrainings = useMemo(
    () => listChatSelectableTrainings(allPlans, trainingsById as Record<number, Training>),
    [allPlans, trainingsById],
  );

  const selectedContext = useMemo(() => {
    if (selectedTrainingId == null) return null;
    return buildSelectedTrainingContext(
      selectedTrainingId,
      trainingsById as Record<number, Training>,
      workoutsById,
      exercisesById,
      videoAnalysesById,
      buildTrainingLocators(allPlans, trainingsById as Record<number, Training>),
    );
  }, [selectedTrainingId, allPlans, trainingsById, workoutsById, exercisesById, videoAnalysesById]);

  const contextParts: ChatContextParts = useMemo(
    () => ({
      finishedJson: seedContextJson,
      // Switched off means switched off — the planning JSON is not built into the prompt at all.
      plannedJson: includePlanned && plannedContext ? JSON.stringify(plannedContext) : null,
      selectedJson: selectedContext ? JSON.stringify(selectedContext) : null,
    }),
    [seedContextJson, includePlanned, plannedContext, selectedContext],
  );

  const contextSections = useMemo(() => chatContextSections(contextParts), [contextParts]);
  const contextSize = useMemo(() => chatContextSize(contextParts), [contextParts]);

  const plannedSessionCount = plannedContext?.sessions.length ?? 0;
  const selectedTrainingLabel = useMemo(
    () => selectableTrainings.find(t => t.id === selectedTrainingId)?.label,
    [selectableTrainings, selectedTrainingId],
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messages.length]);

  // GH-293 one-time migration: the conversation that existed before the history
  // feature shipped becomes the first history entry. The flag is set by redux
  // migration 11. It is cleared synchronously before the async archive so the
  // effect cannot fire twice; if the file write fails, the messages simply stay
  // in the active chat — nothing is lost.
  useEffect(() => {
    if (!pendingLegacyArchive) return;
    dispatch(setPendingLegacyArchive(false));
    (async () => {
      await archiveActiveChat();
      dispatch(clearChat());
    })();
  }, [pendingLegacyArchive, archiveActiveChat, dispatch]);

  const applyPreset = (preset: Preset) => {
    setSelectedPreset(preset);
    if (preset === 'Custom') return;
    let range: Range;
    if (preset === '7d') {
      range = makeRange(7);
    } else if (preset === '28d') {
      range = makeRange(28);
    } else if (preset === '3M') {
      range = makeRange(90);
    } else {
      // Meso
      if (!mesoRange) return;
      range = new Range(mesoRange.start, mesoRange.end);
    }
    dispatch(setContextRange(toContextRange(range)));
  };

  const handleRangeChange = (range: Range) => {
    setSelectedPreset('Custom');
    dispatch(setContextRange(toContextRange(range)));
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const apiKey = secureStorage.getAnthropicApiKey();
    if (!apiKey) {
      dispatch(setError('No API key configured. Add your Anthropic API key in Settings.'));
      return;
    }

    // Resolve context JSON: prefer Redux value (already computed by useEffect).
    // Inline fallback guards against a race where useEffect hasn't run yet on first send.
    let contextJson = seedContextJson;
    if (contextJson === null && allFinishedTrainings.length > 0) {
      const range = contextRange ? fromContextRange(contextRange) : makeRange(28);
      const filtered = filterTrainingsByDateRange(allFinishedTrainings, range.startDate, range.endDate);
      contextJson = serializeTrainingsForChat(filtered, workoutsById, exercisesById, videoAnalysesById);
      if (contextJson) {
        dispatch(setSeedContextJson(contextJson));
      }
    }

    // GH-391: the prompt is assembled from the same parts the context preview
    // renders, so what the user inspects is exactly what the model receives.
    const partsForSend: ChatContextParts = {...contextParts, finishedJson: contextJson};
    console.log(
      `[AIChatTab] handleSend: finished=${contextJson ? `${contextJson.length}c` : 'null'} ` +
        `planned=${partsForSend.plannedJson ? `${partsForSend.plannedJson.length}c` : 'off/none'} ` +
        `selected=${partsForSend.selectedJson ? `${partsForSend.selectedJson.length}c` : 'none'} ` +
        `finishedTrainings=${allFinishedTrainings.length}`,
    );

    const userMsg: ChatMessage = {role: 'user', content: text};
    dispatch(appendMessage(userMsg));
    setInputText('');
    dispatch(setLoading(true));
    dispatch(setError(null));

    const systemPrompt = buildChatSystemPrompt(chatPrompt, partsForSend);

    const history: ChatMessage[] = [...messages, userMsg];
    const result = await sendChatMessage(history, apiKey, systemPrompt, model);

    if (result.ok) {
      dispatch(appendMessage({role: 'assistant', content: result.text, hadContext: result.hadContext}));
      dispatch(setLoading(false));
    } else {
      dispatch(setError(result.error));
    }
  };

  // GH-293: Clear no longer discards the conversation — it is archived into the
  // chat history first, then a fresh empty chat starts. The ref guards against
  // a double tap archiving the same conversation twice.
  const clearingRef = useRef(false);
  const handleClear = async () => {
    if (clearingRef.current) return;
    clearingRef.current = true;
    try {
      await archiveActiveChat();
      dispatch(clearChat());
      setInputText('');
    } finally {
      clearingRef.current = false;
    }
  };

  const contextBadgeLabel = useMemo(() => {
    if (selectedPreset === 'Meso' && mesoRange) return `Meso: ${mesoRange.name}`;
    if (selectedPreset === 'Custom') {
      return `${formatDateISO(effectiveRange.startDate)} – ${formatDateISO(effectiveRange.endDate)}`;
    }
    return `Context: ${selectedPreset}`;
  }, [selectedPreset, mesoRange, effectiveRange]);

  const renderMessage = ({item}: {item: ChatMessage}) => {
    const isUser = item.role === 'user';
    return (
      <View>
        {/* No-context warning banner: shown only on assistant messages without attached context */}
        {!isUser && item.hadContext === false && (
          <View
            style={[styles.noContextBanner, {backgroundColor: theme.colors.errorContainer}]}
            testID="chat-no-context-warning"
          >
            <Text variant="labelSmall" style={{color: theme.colors.onErrorContainer}}>
              No context attached — AI answered without training data
            </Text>
          </View>
        )}
        <View
          style={[styles.messageBubbleRow, isUser ? styles.rowRight : styles.rowLeft]}
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
            {isUser ? (
              <Text
                variant="bodyMedium"
                style={{color: theme.colors.onPrimary}}
                testID="chat-bubble-user-text"
              >
                {item.content}
              </Text>
            ) : (
              <Markdown
                style={aiChatMarkdownStyles(theme)}
                testID="chat-bubble-assistant-markdown"
              >
                {item.content}
              </Markdown>
            )}
          </Surface>
        </View>
      </View>
    );
  };

  if (!hasApiKey) {
    return (
      <View style={[styles.centeredContainer, {backgroundColor: theme.colors.background, paddingBottom: insets.bottom}]}>
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
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text variant="titleMedium" style={{color: theme.colors.onSurface, flex: 1}}>
          AI Chat
        </Text>
        {!showFilters && (
          <Text
            variant="labelSmall"
            style={[styles.contextBadge, {color: theme.colors.onSurfaceVariant}]}
            testID="chat-context-badge"
            numberOfLines={1}
          >
            {contextBadgeLabel}
          </Text>
        )}
        <IconButton
          icon="history"
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => navigation.navigate('ChatHistory')}
          testID="chat-history-button"
        />
        <IconButton
          icon={showFilters ? 'filter-remove-outline' : 'filter-outline'}
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => setShowFilters(v => !v)}
          testID="chat-filter-toggle"
        />
        <IconButton
          icon="delete-outline"
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={handleClear}
          testID="chat-clear-button"
          disabled={isEmpty && !error}
        />
      </View>

      {/* GH-391 context bar — always visible, so the planning half of the context
          and the current conversation subject are never hidden behind a filter. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.contextBarRow}
        contentContainerStyle={styles.contextBarContent}
        testID="chat-context-bar"
      >
        <Chip
          icon={includePlanned ? 'calendar-check' : 'calendar-remove'}
          selected={includePlanned}
          showSelectedCheck={false}
          onPress={() => dispatch(setIncludePlannedTrainings(!includePlanned))}
          style={styles.chip}
          testID="chat-planned-toggle"
        >
          {includePlanned
            ? `Plan: ${plannedSessionCount} session${plannedSessionCount !== 1 ? 's' : ''}`
            : 'Plan: off'}
        </Chip>
        <Chip
          icon={selectedTrainingId != null ? 'target' : 'target-variant'}
          selected={selectedTrainingId != null}
          showSelectedCheck={false}
          onPress={() => setShowTrainingPicker(true)}
          onClose={selectedTrainingId != null ? () => dispatch(setSelectedTrainingId(null)) : undefined}
          closeIconAccessibilityLabel="Clear selected training"
          style={styles.chip}
          testID="chat-subject-chip"
        >
          {selectedTrainingLabel ?? 'Training: none'}
        </Chip>
        <Chip
          icon="text-box-search-outline"
          onPress={() => setShowContextPreview(true)}
          style={styles.chip}
          testID="chat-context-inspect"
        >
          {`View context (${contextSize})`}
        </Chip>
      </ScrollView>

      {/* Collapsible filter section */}
      {showFilters && (
        <View testID="chat-filter-section">
          {/* Preset chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
            contentContainerStyle={styles.chipsContent}
            testID="chat-preset-chips"
          >
            {(['7d', '28d', '3M'] as Preset[]).map(preset => (
              <Chip
                key={preset}
                selected={selectedPreset === preset}
                onPress={() => applyPreset(preset)}
                style={styles.chip}
                testID={`chat-preset-${preset}`}
              >
                {preset}
              </Chip>
            ))}
            {mesoRange != null && (
              <Chip
                selected={selectedPreset === 'Meso'}
                onPress={() => applyPreset('Meso')}
                style={styles.chip}
                testID="chat-preset-Meso"
              >
                Meso
              </Chip>
            )}
            <Chip
              selected={selectedPreset === 'Custom'}
              onPress={() => applyPreset('Custom')}
              style={styles.chip}
              testID="chat-preset-Custom"
            >
              Custom
            </Chip>
          </ScrollView>

          {/* DateRangePicker */}
          <View style={styles.pickerRow} testID="chat-date-range-picker">
            <DateRangePicker range={effectiveRange} setRange={handleRangeChange} />
          </View>

          {/* Info line */}
          <Text
            variant="bodySmall"
            style={[styles.infoLine, {color: theme.colors.onSurfaceVariant}]}
            testID="chat-context-info"
          >
            {`AI has access to ${filteredCount} training${filteredCount !== 1 ? 's' : ''} (${formatDateISO(effectiveRange.startDate)} – ${formatDateISO(effectiveRange.endDate)})`}
          </Text>

          {/* GH-391: the planning half is independent of the date range above. */}
          <Text
            variant="bodySmall"
            style={[styles.infoLine, {color: theme.colors.onSurfaceVariant}]}
            testID="chat-planned-info"
          >
            {!includePlanned
              ? 'Plan not attached'
              : plannedContext
                ? `Plan attached: ${plannedSessionCount} planned session${plannedSessionCount !== 1 ? 's' : ''} (${plannedContext.scope})`
                : 'Plan attached: nothing planned'}
          </Text>
        </View>
      )}

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderMessage}
        style={styles.messageListFlex}
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
        <View
          style={[styles.loadingRow, {backgroundColor: theme.colors.surfaceVariant}]}
          testID="chat-loading"
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text variant="bodySmall" style={{marginLeft: 8, color: theme.colors.onSurfaceVariant}}>
            AI is thinking…
          </Text>
        </View>
      )}

      {/* Error message */}
      {error && !isLoading && (
        <View
          style={[styles.errorRow, {backgroundColor: theme.colors.errorContainer}]}
          testID="chat-error"
        >
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

      {/* Input row — full-width touchable area, min 48dp height per Material guidelines */}
      <View
        style={[styles.inputRow, {borderTopColor: theme.colors.outlineVariant}]}
        testID="chat-input-row"
      >
        <TextInput
          ref={textInputRef}
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
      <View style={{height: insets.bottom}} />

      <ChatContextPreviewDialog
        visible={showContextPreview}
        onDismiss={() => setShowContextPreview(false)}
        sections={contextSections}
        size={contextSize}
      />
      <ChatTrainingPickerDialog
        visible={showTrainingPicker}
        onDismiss={() => setShowTrainingPicker(false)}
        trainings={selectableTrainings}
        selectedId={selectedTrainingId}
        onSelect={id => {
          dispatch(setSelectedTrainingId(id));
          setShowTrainingPicker(false);
        }}
      />
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
  contextBadge: {
    flexShrink: 1,
    marginRight: 4,
  },
  chipsRow: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 12,
  },
  contextBarRow: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 12,
  },
  contextBarContent: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
  },
  chipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    marginRight: 0,
  },
  pickerRow: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoLine: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  messageListFlex: {
    flex: 1,
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
  noContextBanner: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginVertical: 2,
    alignSelf: 'flex-start',
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
    flexShrink: 0,
    minHeight: 73,
  },
  textInput: {
    minHeight: 48,
  },
});

export default AIChatTab;
