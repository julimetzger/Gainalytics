import {TrainingsState} from "./TrainingsState";

export type Training = {
    id?: number;
    doneWorkoutIds: { [exerciseId: number]: number };
    plannedWorkouts: { [exerciseId: number]: number };
    exercises: number[];
    notes?: String;
    start?: Date;
    end?: Date;
    state: TrainingsState,
}
