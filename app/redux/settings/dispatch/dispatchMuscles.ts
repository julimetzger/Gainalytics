import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {Muscles} from '../../../models/Muscles';

type MuscleAction = Action & {muscle: Muscles};

export const dispatchAddMuscle = () => {
  const dispatch = useDispatch();

  return (muscle: Muscles) => dispatch({type: 'ADD_MUSCLE', muscle} satisfies MuscleAction);
};

/** Also strips the muscle from every exercise (exercises reducer). */
export const dispatchRemoveMuscle = () => {
  const dispatch = useDispatch();

  return (muscle: Muscles) => dispatch({type: 'REMOVE_MUSCLE', muscle} satisfies MuscleAction);
};

export const dispatchSetMuscleInOverviews = () => {
  const dispatch = useDispatch();

  return (muscle: Muscles, visible: boolean) => dispatch({type: 'SET_MUSCLE_IN_OVERVIEWS', muscle, visible} satisfies MuscleAction & {visible: boolean});
};
