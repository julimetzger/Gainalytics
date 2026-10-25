import {useDispatch} from 'react-redux';
import {BodyWeightEntry} from '../../../models/entities/BodyWeightEntry';

export const dispatchAddBodyWeightEntry = () => {
  const dispatch = useDispatch();
  return (entry: Omit<BodyWeightEntry, 'id'>) => dispatch({type: 'ADD_BODY_WEIGHT_ENTRY', entry});
};

export const dispatchEditBodyWeightEntry = () => {
  const dispatch = useDispatch();
  return (entry: BodyWeightEntry) => dispatch({type: 'EDIT_BODY_WEIGHT_ENTRY', entry});
};

export const dispatchDeleteBodyWeightEntry = () => {
  const dispatch = useDispatch();
  return (entryId: number) => dispatch({type: 'DELETE_BODY_WEIGHT_ENTRY', entryId});
};
