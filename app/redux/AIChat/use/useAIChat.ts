import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {appendMessage, clearChat, setError, setLoading, startChatWithContext} from '../aiChatSlice';
import {ChatMessage} from '../../../utils/ai/sendChatMessage';

export function useAIChat() {
  const dispatch = useDispatch();
  const messages = useSelector((s: GlobalState) => s.aiChat.messages);
  const isLoading = useSelector((s: GlobalState) => s.aiChat.isLoading);
  const error = useSelector((s: GlobalState) => s.aiChat.error);

  return {
    messages,
    isLoading,
    error,
    appendMessage: (msg: ChatMessage) => dispatch(appendMessage(msg)),
    setLoading: (v: boolean) => dispatch(setLoading(v)),
    setError: (msg: string | null) => dispatch(setError(msg)),
    clearChat: () => dispatch(clearChat()),
    startChatWithContext: (ctx: string) => dispatch(startChatWithContext(ctx)),
  };
}
