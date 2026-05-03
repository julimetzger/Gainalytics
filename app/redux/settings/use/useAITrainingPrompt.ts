import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {DEFAULT_TRAINING_PROMPT} from '../../../constants/aiPrompts';

export function useAITrainingPrompt(): string {
  const stored = useSelector((state: GlobalState) => state.settings.aiTrainingPrompt);
  return stored && stored.trim() ? stored.trim() : DEFAULT_TRAINING_PROMPT;
}
