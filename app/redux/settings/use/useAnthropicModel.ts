import {useEffect} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {DEFAULT_ANTHROPIC_MODEL, setAnthropicModel} from '../../../utils/llmApi';

export function useAnthropicModel(): string {
  const stored = useSelector((state: GlobalState) => state.settings.anthropicModel);
  const model = stored && stored.trim() ? stored.trim() : DEFAULT_ANTHROPIC_MODEL;

  useEffect(() => {
    setAnthropicModel(model);
  }, [model]);

  return model;
}
