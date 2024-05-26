import {WorkoutSet} from "./WorkoutSet";
import {Acuumalatable} from "../tabs/Analyse/HandleAccumulationModeBatching";

export interface Workout extends Acuumalatable{
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
