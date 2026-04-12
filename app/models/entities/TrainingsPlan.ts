export type Meso = {
  id: number;
  name: string;
  order: number;
  startMicro: number;
};

export type TrainingsPlan = {
  id?: number;
  name: string;
  description?: string;
  trainings: {[microComaTrainingInMicro: string]: number};
  trainingNames: {[training: string]: string};
  lastTraining?: number;
  mesos?: Meso[];
};
