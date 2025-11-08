import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {trainingInMicroIndex} from "../trainingsPlanReducer";

export const useTrainingInTrainingsPlan = (trainingsPlanId: number, micro: number, trainingInMicro: number) => useSelector((state: GlobalState) => {
            let trainingId = state.trainingsPlan.byId[trainingsPlanId]?.trainings[trainingInMicroIndex(micro, trainingInMicro)];
            return state.trainings.byId[trainingId];
        }
    )
;
