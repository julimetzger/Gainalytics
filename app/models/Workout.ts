import {WorkoutSet} from "./WorkoutSet";

export type Workout = {
    id?: number
    sets: WorkoutSet[];
    notes: String;
    exerciseId: number;
    start?: Date;
    end?: Date;
    // TODO fill this in reducer to have real one to many relation
    trainingsId?: number;
    records?: {
        [recordAsString: string]: number
    }
};
