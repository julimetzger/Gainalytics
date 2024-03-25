import {Muscles} from "./Muscles";


export type Exercise = {
    id?: number;
    name: string;
    muscles?: MusclePercentPair[]
    records?: {
        [recordAsString: string]: ExerciseRecord[]
    }
}

interface ExerciseRecord {
    value: number;
    workoutId: number;
}

export interface MusclePercentPair {
    muscle?: Muscles,
    percent?: number
}


export enum Record {
    ONE_RM = "1RM",
}


