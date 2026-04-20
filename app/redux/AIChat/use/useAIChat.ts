import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {
  appendMessage,
  clearChat,
  setError,
  setLoading,
  startChatWithContext,
  setSeedContextJson,
  setContextRange,
  ChatSeedContext,
  ContextRange,
} from '../aiChatSlice';
import {ChatMessage} from '../../../utils/ai/sendChatMessage';

export function useAIChat() {
  const dispatch = useDispatch();
  const messages = useSelector((s: GlobalState) => s.aiChat.messages);
  const isLoading = useSelector((s: GlobalState) => s.aiChat.isLoading);
  const error = useSelector((s: GlobalState) => s.aiChat.error);
  const contextRange = useSelector((s: GlobalState) => s.aiChat.contextRange);

  return {
    messages,
    isLoading,
    error,
    contextRange,
    appendMessage: (msg: ChatMessage) => dispatch(appendMessage(msg)),
    setLoading: (v: boolean) => dispatch(setLoading(v)),
    setError: (msg: string | null) => dispatch(setError(msg)),
    clearChat: () => dispatch(clearChat()),
    startChatWithContext: (ctx: ChatSeedContext) => dispatch(startChatWithContext(ctx)),
    setSeedContextJson: (json: string | null) => dispatch(setSeedContextJson(json)),
    setContextRange: (range: ContextRange | null) => dispatch(setContextRange(range)),
  };
}
