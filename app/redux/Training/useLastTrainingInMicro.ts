import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {getTrainingsInMicro} from "./trainingsPlanReducer";

export const useLastTrainingInMicro = (trainingsPlanId: number, trainingsNumber: number) =>
    useSelector((state: GlobalState) => {
        let trainingsId = getTrainingsInMicro(state.trainingsPlan.byId[trainingsPlanId].trainings, trainingsNumber)
            .pop();
        return trainingsId ? state.trainings.byId[trainingsId] : undefined;
    });
