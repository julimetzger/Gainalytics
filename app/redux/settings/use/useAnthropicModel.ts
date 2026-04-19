import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {DEFAULT_ANTHROPIC_MODEL} from '../../../utils/llmApi';

export function useAnthropicModel(): string {
  const stored = useSelector((state: GlobalState) => state.settings.anthropicModel);
  return stored && stored.trim() ? stored.trim() : DEFAULT_ANTHROPIC_MODEL;
}
