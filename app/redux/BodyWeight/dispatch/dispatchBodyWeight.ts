// Hooks (they call useDispatch), hence use* instead of the older dispatch* naming.
import {useDispatch} from 'react-redux';
import {BodyWeightEntry} from '../../../models/entities/BodyWeightEntry';

export const useAddBodyWeightEntry = () => {
  const dispatch = useDispatch();
  return (entry: Omit<BodyWeightEntry, 'id'>) => dispatch({type: 'ADD_BODY_WEIGHT_ENTRY', entry});
};

export const useEditBodyWeightEntry = () => {
  const dispatch = useDispatch();
  return (entry: BodyWeightEntry) => dispatch({type: 'EDIT_BODY_WEIGHT_ENTRY', entry});
};

export const useDeleteBodyWeightEntry = () => {
  const dispatch = useDispatch();
  return (entryId: number) => dispatch({type: 'DELETE_BODY_WEIGHT_ENTRY', entryId});
};
