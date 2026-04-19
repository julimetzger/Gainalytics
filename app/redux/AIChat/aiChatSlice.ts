import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ChatMessage} from '../../utils/ai/sendChatMessage';

export interface AIChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

const initialState: AIChatState = {
  messages: [],
  isLoading: false,
  error: null,
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
    },
    /** Resets the conversation and seeds it with the given context as the first assistant message. */
    startChatWithContext(state, action: PayloadAction<string>) {
      state.messages = [{role: 'assistant', content: action.payload}];
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const {appendMessage, setLoading, setError, clearChat, startChatWithContext} =
  aiChatSlice.actions;
export default aiChatSlice.reducer;
