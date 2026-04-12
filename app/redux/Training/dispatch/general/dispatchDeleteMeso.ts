import {useDispatch} from 'react-redux';

export default function dispatchDeleteMeso() {
  const dispatch = useDispatch();
  return (trainingsPlanId: number, mesoId: number) =>
    dispatch({type: 'DELETE_MESO', trainingsPlanId, mesoId});
}
