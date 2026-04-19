import {useDispatch} from 'react-redux';

export function dispatchSetAnthropicModel() {
  const dispatch = useDispatch();
  return (model: string) => {
    dispatch({type: 'SET_ANTHROPIC_MODEL', model});
  };
}
