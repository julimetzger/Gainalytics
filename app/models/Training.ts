type Training = {
    id?: number;
    doneWorkoutIds: { [exerxiseId: number]: number };
    plannedWorkouts: { [exerxiseId: number]: number };
    exercises: number[];
    notes?: String;
    start?: Date;
    end?: Date;
    finished: boolean;
    started: boolean;
}
