import {Accumulation, AccumulationMode} from '../components/picker/elements/TrainingElementPicker';
import {firstDayOfWeek, getFirstDayOfMonth} from './DateHelper';
import {getAllTrainingsForMicro, getMicroFromTrainingInMicroIndex} from '../redux/Training/trainingsPlanReducer';

export const handleAccumulationModeBatching = (allWorkouts: Acuumalatable[], accumulationMode?: Accumulation) => {
  return (acc: Map<string, Acuumalatable[]>, workout: Acuumalatable): Map<string, Acuumalatable[]> => {
    switch (accumulationMode?.getAccumulationMode()) {
      case AccumulationMode.SINGLE_DAY: {
        let dateDayStart = new Date(new Date(workout.start!!).setHours(0, 0, 0, 0));
        if (acc.get(dateDayStart.toISOString())) {
          acc.get(dateDayStart.toISOString())!!.push(workout);
        } else {
          acc.set(dateDayStart.toISOString(), [workout]);
        }
        return acc;
      }
      case AccumulationMode.WEEK: {
        let start = new Date(firstDayOfWeek(workout.start!!, 1));
        if (acc.get(start.toISOString())) {
          acc.get(start.toISOString())!!.push(workout);
        } else {
          acc.set(start.toISOString(), [workout]);
        }
        return acc;
      }
      case AccumulationMode.MONTH: {
        let start = new Date(getFirstDayOfMonth(workout.start!!));
        if (acc.get(start.toISOString())) {
          acc.get(start.toISOString())!!.push(workout);
        } else {
          acc.set(start.toISOString(), [workout]);
        }
        return acc;
      }
      case AccumulationMode.TRAINING_MICROCYCLE: {
        let trainingsPlan = accumulationMode?.trainingsPlan;
        if (trainingsPlan) {
          let trainings = trainingsPlan.trainings;
          if (workout.trainingsId && Object.values(trainings).includes(workout.trainingsId)) {
            Object.entries(trainings).forEach(([key, value]) => {
              if (workout.trainingsId === value) {
                let micro = getMicroFromTrainingInMicroIndex(key);
                let allTrainingsForMicro = getAllTrainingsForMicro(trainings, micro);
                let dates = allWorkouts
                  .filter((workout: Acuumalatable) => allTrainingsForMicro.includes(workout.trainingsId!!))
                  .map((workout: Acuumalatable) => workout.start!!)
                  .sort();
                if (dates.length > 0) {
                  let start = new Date(dates[0]);
                  if (acc.get(start.toISOString())) {
                    acc.get(start.toISOString())!!.push(workout);
                  } else {
                    acc.set(start.toISOString(), [workout]);
                  }
                }
              }
            });
          }
        }
        return acc;
      }
    }
    return acc;
  };
};

export interface Acuumalatable {
  start?: Date;
  trainingsId?: number;
}
