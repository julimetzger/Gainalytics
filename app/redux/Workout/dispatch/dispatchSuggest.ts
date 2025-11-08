import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSuggest = () => {
  const dispatch = useDispatch();

  return (exerciseId: number) =>
    dispatch({
      type: 'SUGGEST_WORKOUT',
      exerciseId,
    } as Action);
};
