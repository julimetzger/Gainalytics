import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {DEFAULT_SESSION_PROMPT} from '../../../constants/aiPrompts';

/** GH-645: the system prompt of the single-training Coach Insight. */
export function useAISessionPrompt(): string {
  const stored = useSelector((state: GlobalState) => state.settings.aiSessionPrompt);
  return stored && stored.trim() ? stored.trim() : DEFAULT_SESSION_PROMPT;
}
