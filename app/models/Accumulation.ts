import {AccumulationMode} from './AccumulationMode';
import {TrainingsPlan} from './entities/TrainingsPlan';

/** How the Analyse screens group workouts ("Group by"): a calendar mode or the micro cycles of one plan. */
export class Accumulation {
  accumulationMode: AccumulationMode;
  trainingsPlan?: TrainingsPlan;

  constructor(accumulationMode: AccumulationMode, trainingsId?: TrainingsPlan) {
    this.accumulationMode = accumulationMode;
    this.trainingsPlan = trainingsId;
  }

  static fromTrainingsPlan(trainingsPlan: TrainingsPlan) {
    return new Accumulation(AccumulationMode.TRAINING_MICROCYCLE, trainingsPlan);
  }

  static forAllNonTrainingModes() {
    return Object.values(AccumulationMode)
      .map((value: string) => new Accumulation(value as AccumulationMode))
      .filter((value: Accumulation) => value.accumulationMode !== AccumulationMode.TRAINING_MICROCYCLE);
  }

  getAccumulationMode() {
    return this.accumulationMode;
  }

  getName() {
    return this.trainingsPlan?.name ?? this.accumulationMode;
  }

  getId() {
    return 'accumulation' + this.getName();
  }
}
