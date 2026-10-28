import {useDispatch} from 'react-redux';

export function dispatchSetAISessionPrompt() {
  const dispatch = useDispatch();
  return (prompt: string) => {
    dispatch({type: 'SET_AI_SESSION_PROMPT', prompt});
  };
}

export function dispatchResetAISessionPrompt() {
  const dispatch = useDispatch();
  return () => {
    dispatch({type: 'RESET_AI_SESSION_PROMPT'});
  };
}
