import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

/** The chosen ChatGPT model, or undefined for "first model the plan offers". */
export function useChatGptModel(): string | undefined {
  const stored = useSelector((state: GlobalState) => state.settings?.chatgptModel);
  return typeof stored === 'string' && stored.trim() ? stored.trim() : undefined;
}
