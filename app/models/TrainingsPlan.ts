export type TrainingsPlan = {
    id?: number;
    name: string;
    description?: string;
    trainings: { [microComaTrainingInMicro: string]: number },
    lastTrainingInMicro?: number;
    lastMicro?: number;
}
