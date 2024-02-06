type TrainingsPlan = {
    id?: number;
    name: string;
    description?: string;
    trainings: { [microComaTraingInMicro: string]: number },
    lastTrainingInMicro?: number;
    lastMicro?: number;
}
