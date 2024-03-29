import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {Muscles} from '../../models/Muscles';
import {Exercise, ExerciseRecord} from "../../models/Exercise";

const initialState = {
    byId: {
        1: {
            id: 1, name: 'Benchpress', muscles: [
                {muscle: Muscles.CHEST, percent: 100},
                {muscle: Muscles.TRICEPS, percent: 70},
                {muscle: Muscles.SHOULDERS, percent: 10}
            ]
        },
        2: {
            id: 2, name: 'Squat', muscles: [
                {muscle: Muscles.GLUTES, percent: 100},
                {muscle: Muscles.QUADS, percent: 100},
                {muscle: Muscles.HAMSTRINGS, percent: 50},
                {muscle: Muscles.CORE, percent: 30},
                {muscle: Muscles.BACK, percent: 20}
            ]
        },
        3: {
            id: 3, name: 'Deadlift', muscles: [
                {muscle: Muscles.BACK, percent: 50},
                {muscle: Muscles.HAMSTRINGS, percent: 50},
                {muscle: Muscles.GLUTES, percent: 50},
                {muscle: Muscles.QUADS, percent: 30},
                {muscle: Muscles.CORE, percent: 30}
            ]
        },
        4: {
            id: 4, name: 'Overheadpress', muscles: [
                {muscle: Muscles.SHOULDERS, percent: 100},
                {muscle: Muscles.TRICEPS, percent: 50}
            ]
        },
        5: {
            id: 5, name: 'Cable Pushdowns', muscles: [
                {muscle: Muscles.TRICEPS, percent: 100}
            ]
        },
        6: {
            id: 6, name: 'Dips', muscles: [
                {muscle: Muscles.TRICEPS, percent: 100},
                {muscle: Muscles.CHEST, percent: 80}
            ]
        },
        7: {
            id: 7, name: 'Butterfly', muscles: [
                {muscle: Muscles.CHEST, percent: 100},
                {muscle: Muscles.SHOULDERS, percent: 10}
            ]
        },
        8: {
            id: 8, name: 'Pull-Ups', muscles: [
                {muscle: Muscles.BACK, percent: 100},
                {muscle: Muscles.BICEPS, percent: 80}
            ]
        },
        9: {
            id: 9, name: 'Biceps-Curls', muscles: [
                {muscle: Muscles.BICEPS, percent: 100}
            ]
        },
        10: {
            id: 10, name: 'Cable-Curls', muscles: [
                {muscle: Muscles.BICEPS, percent: 100}
            ]
        },
        11: {
            id: 11, name: 'Facepulls', muscles: [
                {muscle: Muscles.SHOULDERS, percent: 100},
                {muscle: Muscles.BACK, percent: 20}
            ]
        },
        12: {
            id: 12, name: 'Reverse Flys', muscles: [
                {muscle: Muscles.SHOULDERS, percent: 100},
                {muscle: Muscles.BACK, percent: 20}
            ]
        },
        13: {
            id: 13, name: 'Lateral Raise', muscles: [
                {muscle: Muscles.SHOULDERS, percent: 100}
            ]
        },
        14: {
            id: 14, name: 'Leg Press', muscles: [
                {muscle: Muscles.GLUTES, percent: 100},
                {muscle: Muscles.QUADS, percent: 100},
                {muscle: Muscles.HAMSTRINGS, percent: 20}
            ]
        },
        15: {
            id: 15, name: 'Leg Curls', muscles: [
                {muscle: Muscles.HAMSTRINGS, percent: 100}
            ]
        },
        16: {
            id: 16, name: 'Leg Extensions', muscles: [
                {muscle: Muscles.HAMSTRINGS, percent: 100}
            ]
        },
        17: {
            id: 17, name: 'Hip Adduction', muscles: [
                {muscle: Muscles.HAMSTRINGS, percent: 10}
            ]
        },
        18: {
            id: 18, name: 'Hip Abduction', muscles: [
                {muscle: Muscles.GLUTES, percent: 50}
            ]
        },
        19: {
            id: 19, name: 'Hyperextensions', muscles: [
                {muscle: Muscles.GLUTES, percent: 100},
                {muscle: Muscles.HAMSTRINGS, percent: 50},
                {muscle: Muscles.BACK, percent: 10}
            ]
        },
        20: {
            id: 20, name: 'Hip Thrusts', muscles: [
                {muscle: Muscles.GLUTES, percent: 100},
                {muscle: Muscles.HAMSTRINGS, percent: 50}
            ]
        },
    },
    allIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
} as NormalizedState<Exercise>

const exerciseReducer = (exercises: NormalizedState<Exercise> = initialState, action: AnyAction) => {
        switch (action.type) {
            case 'ADD_EXERCISE': {
                const newId = Math.max(...exercises.allIds) + 1;
                return {
                    byId: {
                        ...exercises.byId,
                        [newId]: {id: newId, name: action.nameOfExercise, muscles: action.muscles} as Exercise
                    },
                    allIds: [...exercises.allIds, newId],
                };
            }
            case 'DELETE_EXERCISE': {
                const index = exercises.allIds.indexOf(action.exerciseId);
                exercises.allIds.splice(index, 1);
                delete exercises.byId[action.exerciseId];
                return {
                    byId: {
                        ...exercises.byId,
                    },
                    allIds: [...exercises.allIds],
                };
            }
            case 'EDIT_EXERCISE': {
                return {
                    byId: {
                        ...exercises.byId,
                        [action.exerciseId]: {
                            ...exercises.byId[action.exerciseId],
                            name: action.nameOfExercise,
                            muscles: action.muscles,
                        },
                    },
                    allIds: [...exercises.allIds],
                };
            }
            case 'ADD_RECORD': {
                let recordExercise = {...exercises.byId[action.exerciseId]};
                if (recordExercise.records === undefined)
                    recordExercise.records = {[action.record]: []};
                recordExercise.records[action.record].push({value: action.value, workoutId: action.workoutId});
                return {
                    ...exercises,
                    byId: {
                        ...exercises.byId,
                        [action.exerciseId]: {
                            ...recordExercise,
                            records: {...recordExercise.records},
                        },
                    },
                };
            }
            case 'UPDATE_RECORD': {
                let recordExercise = {...exercises.byId[action.exerciseId]};
                if (recordExercise.records === undefined)
                    recordExercise.records = {[action.record]: []};
                recordExercise.records[action.record].find(record => record.workoutId === action.workoutId)!.value = action.value;
                return {
                    ...exercises,
                    byId: {
                        ...exercises.byId,
                        [action.exerciseId]: {
                            ...recordExercise,
                            records: {...recordExercise.records},
                        },
                    },
                };
            }
            case 'DELETE_RECORD': {
                let recordExercise = {...exercises.byId[action.exerciseId]};
                if (recordExercise.records === undefined)
                    recordExercise.records = {[action.record]: []};
                recordExercise.records[action.record] = recordExercise.records[action.record].filter(record => record.workoutId !== action.workoutId);
                return {
                    ...exercises,
                    byId: {
                        ...exercises.byId,
                        [action.exerciseId]: {
                            ...recordExercise,
                            records: {...recordExercise.records},
                        },
                    },
                };
            }
            case 'DELETE_WORKOUT': {
                let workout = action.workout;
                let exerciseForWorkout = {...exercises.byId[workout.exerciseId]};
                exerciseForWorkout.records = (exerciseForWorkout.records ? Object.entries(exerciseForWorkout.records)
                    .map(([key, value]) =>
                        [key, value.filter(record => record.workoutId !== workout.id)])
                    .reduce((obj, [key, value]) => ({
                        ...obj,
                        [key as string]: value as ExerciseRecord[]
                    }), {}) : undefined);
                return {
                    ...exercises,
                    byId: {
                        ...exercises.byId,
                        [workout.exerciseId]: exerciseForWorkout
                    }
                };
            }
            default:
                return exercises;
        }
    }
;

export default exerciseReducer;
