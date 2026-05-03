import {useDispatch} from 'react-redux';

export function dispatchSetAIChatPrompt() {
  const dispatch = useDispatch();
  return (prompt: string) => {
    dispatch({type: 'SET_AI_CHAT_PROMPT', prompt});
  };
}
