import {useDispatch} from 'react-redux';
import {AiProvider} from '../../../models/AiProvider';

export function dispatchSetAiProvider() {
  const dispatch = useDispatch();
  return (provider: AiProvider) => {
    dispatch({type: 'SET_AI_PROVIDER', provider});
  };
}
