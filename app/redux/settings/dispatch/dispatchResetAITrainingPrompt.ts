import {useDispatch} from 'react-redux';

export function dispatchResetAITrainingPrompt() {
  const dispatch = useDispatch();
  return () => {
    dispatch({type: 'RESET_AI_TRAINING_PROMPT'});
  };
}
