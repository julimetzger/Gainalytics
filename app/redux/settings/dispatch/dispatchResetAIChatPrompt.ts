import {useDispatch} from 'react-redux';

export function dispatchResetAIChatPrompt() {
  const dispatch = useDispatch();
  return () => {
    dispatch({type: 'RESET_AI_CHAT_PROMPT'});
  };
}
