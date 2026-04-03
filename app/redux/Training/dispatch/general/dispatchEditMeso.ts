import {useDispatch} from 'react-redux';

export default function dispatchEditMeso() {
  const dispatch = useDispatch();
  return (trainingsPlanId: number, mesoId: number, name: string) =>
    dispatch({type: 'EDIT_MESO', trainingsPlanId, mesoId, name});
}
