import {useDispatch} from 'react-redux';

export function dispatchSetChatGptModel() {
  const dispatch = useDispatch();
  return (model: string) => {
    dispatch({type: 'SET_CHATGPT_MODEL', model});
  };
}
