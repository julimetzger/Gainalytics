type TrainingsPlan = {
    id?: number;
    name: string;
    description: string;
    plannedTraingIds: { [micro: number]: number },
    doneTrainingIds: { [micro: number]: number }
    microsInMeso: { [cycle: number]: [number] }
}
