import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {DEFAULT_CHAT_PROMPT} from '../../../constants/aiPrompts';

export function useAIChatPrompt(): string {
  const stored = useSelector((state: GlobalState) => state.settings.aiChatPrompt);
  return stored && stored.trim() ? stored.trim() : DEFAULT_CHAT_PROMPT;
}
