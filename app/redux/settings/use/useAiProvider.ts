import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {AiProvider, resolveAiProvider} from '../../../models/AiProvider';

export function useAiProvider(): AiProvider {
  const stored = useSelector((state: GlobalState) => state.settings?.aiProvider);
  return resolveAiProvider(stored);
}
