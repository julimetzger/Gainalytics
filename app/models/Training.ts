type Training = {
    id?: number;
    doneWorkoutIds: number[];
    plannedWorkouts?: number[];
    notes: String;
    start?: Date;
    end?: Date;
    finished: boolean;
}
