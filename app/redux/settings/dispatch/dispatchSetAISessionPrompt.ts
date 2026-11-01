import {useDispatch} from 'react-redux';

// Hooks (they call useDispatch), hence use* instead of the older dispatch* naming.
export function useSetAISessionPrompt() {
  const dispatch = useDispatch();
  return (prompt: string) => {
    dispatch({type: 'SET_AI_SESSION_PROMPT', prompt});
  };
}

export function useResetAISessionPrompt() {
  const dispatch = useDispatch();
  return () => {
    dispatch({type: 'RESET_AI_SESSION_PROMPT'});
  };
}
