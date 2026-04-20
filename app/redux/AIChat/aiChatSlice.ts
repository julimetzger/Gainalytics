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

export interface AIChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  /** Persisted training context injected into the system prompt on every send. */
  seedContextJson: string | null;
  /** Date range controlling which trainings are included in seedContextJson. null = 28d default. */
  contextRange: ContextRange | null;
}

const initialState: AIChatState = {
  messages: [],
  isLoading: false,
  error: null,
  seedContextJson: null,
  contextRange: null,
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
     *  assistant message; seedContextJson is stored for use as a system prompt supplement. */
    startChatWithContext(state, action: PayloadAction<ChatSeedContext>) {
      state.messages = [{role: 'assistant', content: action.payload.insightText}];
      state.isLoading = false;
      state.error = null;
      state.seedContextJson = action.payload.seedContextJson;
    },
  },
});

export const {
  appendMessage,
  setLoading,
  setError,
  clearChat,
  setSeedContextJson,
  setContextRange,
  startChatWithContext,
} = aiChatSlice.actions;
export default aiChatSlice.reducer;
