import {Muscles} from "./Muscles";


export type Exercise = {
    id?: number;
    name: string;
    muscles?: MusclePercentPair[]
    records?: ExerciseRecord[]
}

interface ExerciseRecord {
    date: Date;
    sets: WorkoutSet[];
    record: Record
}

export interface MusclePercentPair {
    muscle?: Muscles,
    percent?: number
}


export enum Record {
    ONE_RM = "1RM",
}


