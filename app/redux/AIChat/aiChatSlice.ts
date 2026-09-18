import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ChatMessage} from '../../utils/ai/sendChatMessage';

export interface ChatSeedContext {
  /** Short coach-insight text shown as first assistant message. */
  insightText: string;
  /** Compact JSON of finished trainings + meso/micro context, or null when no data. */
  seedContextJson: string | null;
}

export interface ContextRange {
  /** ISO date string for the start of the context window. */
  startDate: string;
  /** ISO date string for the end of the context window. */
  endDate: string;
}

/** Metadata for an archived conversation. The full messages live in a JSON file
 *  on disk (see chatHistoryStorage); Redux only holds what the list UI needs. */
export interface ChatHistoryEntry {
  id: string;
  title: string;
  /** Short excerpt of the conversation so the user can recognise it in the list. */
  snippet: string;
  /** ISO date string of when the conversation was archived. */
  createdAt: string;
  /** File name (not full path) of the chat JSON inside the chat history directory. */
  fileName: string;
  messageCount: number;
}

export interface AIChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** Persisted training context injected into the system prompt on every send. */
  seedContextJson: string | null;
  /** Date range controlling which trainings are included in seedContextJson. null = 28d default. */
  contextRange: ContextRange | null;
  /** Archived conversations, newest first. Full contents live on disk. */
  history: ChatHistoryEntry[];
  /** True after the GH-293 migration when a pre-existing chat still has to be
   *  moved into the history (file write can't happen inside the sync migration). */
  pendingLegacyArchive: boolean;
}

const initialState: AIChatState = {
  messages: [],
  isLoading: false,
  error: null,
  seedContextJson: null,
  contextRange: null,
  history: [],
  pendingLegacyArchive: false,
};

const aiChatSlice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    appendMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    /** GH-447: after a cancel, timeout or error the request produced no reply, so the user
     *  message that triggered it is rolled back. The conversation returns to exactly its
     *  pre-send state and the UI can put the text back in the input box to resend. */
    rollbackPendingUserMessage(state) {
      const last = state.messages[state.messages.length - 1];
      if (last?.role === 'user') {
        state.messages.pop();
      }
      state.isLoading = false;
    },
    clearChat(state) {
      state.messages = [];
      state.isLoading = false;
      state.error = null;
      state.seedContextJson = null;
      // contextRange is intentionally preserved — user's deliberate range choice survives chat clears
    },
    setSeedContextJson(state, action: PayloadAction<string | null>) {
      state.seedContextJson = action.payload;
    },
    setContextRange(state, action: PayloadAction<ContextRange | null>) {
      state.contextRange = action.payload;
    },
    /** Resets the conversation and seeds it with context. The insightText becomes the first
     *  assistant message; seedContextJson is stored for use as a system prompt supplement.
     *  Callers must archive the running chat first — this reducer overwrites it. */
    startChatWithContext(state, action: PayloadAction<ChatSeedContext>) {
      state.messages = [{role: 'assistant', content: action.payload.insightText}];
      state.isLoading = false;
      state.error = null;
      state.seedContextJson = action.payload.seedContextJson;
    },
    /** Adds an archived conversation to the front of the history list. */
    addHistoryEntry(state, action: PayloadAction<ChatHistoryEntry>) {
      state.history.unshift(action.payload);
    },
    /** Removes a history entry by id (delete, or un-archive when resuming). */
    removeHistoryEntry(state, action: PayloadAction<string>) {
      state.history = state.history.filter(e => e.id !== action.payload);
    },
    /** Replaces the active conversation, e.g. when resuming an archived chat. */
    setActiveMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setPendingLegacyArchive(state, action: PayloadAction<boolean>) {
      state.pendingLegacyArchive = action.payload;
    },
  },
});

export const {
  appendMessage,
  setLoading,
  setError,
  rollbackPendingUserMessage,
  clearChat,
  setSeedContextJson,
  setContextRange,
  startChatWithContext,
  addHistoryEntry,
  removeHistoryEntry,
  setActiveMessages,
  setPendingLegacyArchive,
} = aiChatSlice.actions;
export default aiChatSlice.reducer;
