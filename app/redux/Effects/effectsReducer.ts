import {AnyAction} from "@reduxjs/toolkit";
import {Record} from "../../models/Exercise";

export interface ExerciseRecordEffect {
    exerciseId: number;
    workoutId: number;
    date: Date;
    value: number;
    record: Record
}

export interface Effects {
    exerciseRecord?: ExerciseRecordEffect
}

const effectsReducer = (effect: Effects = {}, action: AnyAction) => {
    switch (action.type) {
        case 'ADD_RECORD': {
            return {
                ...effect,
                exerciseRecord: {
                    exerciseId: action.exerciseId,
                    workoutId: action.workoutId,
                    date: new Date(),
                    value: action.value.toFixed(2),
                    record: action.record
                }
            }
        }
        default:
            return {};
    }
}

export default effectsReducer;
