import {useDispatch} from 'react-redux';
import {Meso, TrainingsPlan} from '../../../../models/entities/TrainingsPlan';
import {computeNextMesoStartMicro} from '../../trainingsPlanReducer';

export default function dispatchAddMeso() {
  const dispatch = useDispatch();
  return (trainingsPlanId: number, trainingsPlan: TrainingsPlan) => {
    const existingMesos = trainingsPlan.mesos ?? [];
    const nextStartMicro = computeNextMesoStartMicro(trainingsPlan);
    const newMeso: Meso = {
      id: existingMesos.length > 0 ? Math.max(...existingMesos.map((m) => m.id)) + 1 : 1,
      name: `Meso ${existingMesos.length + 1}`,
      order: existingMesos.length > 0 ? Math.max(...existingMesos.map((m) => m.order)) + 1 : 1,
      startMicro: nextStartMicro,
    };
    dispatch({type: 'ADD_MESO', trainingsPlanId, meso: newMeso});
    return newMeso;
  };
}
