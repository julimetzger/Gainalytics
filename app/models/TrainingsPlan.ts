export type TrainingsPlan = {
    id?: number;
    name: string;
    description?: string;
    trainings: { [microComaTrainingInMicro: string]: number },
    trainingNames: {[training: string]: string },
    lastTrainingInMicro?: number;
    lastMicro?: number;
}
