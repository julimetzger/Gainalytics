// Hooks (they call useDispatch), hence use* instead of the older dispatch* naming.
import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {Muscles} from '../../../models/Muscles';

type MuscleAction = Action & {muscle: Muscles};

export const useAddMuscle = () => {
  const dispatch = useDispatch();

  return (muscle: Muscles) => dispatch({type: 'ADD_MUSCLE', muscle} satisfies MuscleAction);
};

/** Also strips the muscle from every exercise (exercises reducer). */
export const useRemoveMuscle = () => {
  const dispatch = useDispatch();

  return (muscle: Muscles) => dispatch({type: 'REMOVE_MUSCLE', muscle} satisfies MuscleAction);
};

export const useSetMuscleInOverviews = () => {
  const dispatch = useDispatch();

  return (muscle: Muscles, visible: boolean) => dispatch({type: 'SET_MUSCLE_IN_OVERVIEWS', muscle, visible} satisfies MuscleAction & {visible: boolean});
};
