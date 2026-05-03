import {useDispatch} from 'react-redux';

export function dispatchSetAITrainingPrompt() {
  const dispatch = useDispatch();
  return (prompt: string) => {
    dispatch({type: 'SET_AI_TRAINING_PROMPT', prompt});
  };
}
