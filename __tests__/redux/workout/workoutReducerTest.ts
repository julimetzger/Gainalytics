import exerciseReducer from "../../../app/redux/Workout/workoutReducer";

const TEST_DATE = new Date(2020, 1, 1, 1, 1, 2);
const STATE_WITH_TWO_WORKOUTS = () => {
    return {
        allIds: [2, 1],
        byExerciseId:
            {
                11: [1],
                22: [2],
            }
        ,
        byId: {
            1: {
                exerciseId: 11,
                id: 1,
                notes: "",
                sets: [],
                start: TEST_DATE,
                end: TEST_DATE,
            }, 2: {
                exerciseId: 22,
                id: 2,
                notes: "",
                sets: [],
                start: new Date(TEST_DATE.getTime() - 200),
                end: new Date(TEST_DATE.getTime() - 200),
            },
        },
        plannedWorkouts: [],
    }
};
const EMPTY_STATE = {
    byId: {},
    allIds: [],
    byExerciseId: {}
};
const STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION = () => {
    return {
        ...STATE_WITH_TWO_WORKOUTS(),
        byId:
            {
                ...
                    STATE_WITH_TWO_WORKOUTS().byId,
                1:
                    {
                        ...
                            STATE_WITH_TWO_WORKOUTS().byId[1],
                        sets:
                            [{reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1}, {
                                reps: 2,
                                rir: 2,
                                weight: 2,
                                date: TEST_DATE,
                                index: 2
                            }]
                    }
            }
        ,
        suggestedWorkouts:
            {
                11:
                    {
                        exerciseId: 11,
                        id:
                        undefined,
                        notes:
                            "",
                        sets:
                            [{reps: 1, rir: 1, weight: 1, date: undefined, index: 1}, {
                                reps: 2,
                                rir: 2,
                                weight: 2,
                                date: undefined,
                                index: 2
                            }],
                        start:
                        undefined,
                        end:
                        undefined,
                    }
            },
    };
}
describe('workoutReducer', () => {
    describe('ADD_WORKOUT', () => {
        it('should add workout', () => {
            expect(exerciseReducer({...EMPTY_STATE}, {
                type: 'ADD_WORKOUT',
                workout: {exerciseId: 11, notes: '', sets: [], start: TEST_DATE, end: TEST_DATE}
            })).toEqual({
                allIds: [1],
                byExerciseId:
                    {"11": [1,]}
                ,
                byId: {
                    1: {
                        exerciseId: 11,
                        id: 1,
                        notes: "",
                        sets: [],
                        start: TEST_DATE,
                        end: TEST_DATE,
                    }
                },
                notFinishedWorkouts: {11: 1},
                suggestedWorkouts: {}
            })
        })

        it('should add workout in timer ordered', () => {
            expect(exerciseReducer(STATE_WITH_TWO_WORKOUTS(), {
                type: 'ADD_WORKOUT',
                workout: {
                    exerciseId: 11,
                    notes: '',
                    sets: [],
                    start: new Date(TEST_DATE.getTime() - 100),
                    end: new Date(TEST_DATE.getTime() - 100)
                }
            })).toEqual({
                allIds: [2, 3, 1],
                byExerciseId:
                    {
                        11: [3, 1],
                        22: [2],
                    }
                ,
                byId: {
                    1: {
                        exerciseId: 11,
                        id: 1,
                        notes: "",
                        sets: [],
                        start: TEST_DATE,
                        end: TEST_DATE,
                    },
                    2: {
                        exerciseId: 22,
                        id: 2,
                        notes: "",
                        sets: [],
                        start: new Date(TEST_DATE.getTime() - 200),
                        end: new Date(TEST_DATE.getTime() - 200),
                    },
                    3: {
                        exerciseId: 11,
                        id: 3,
                        notes: "",
                        sets: [],
                        start: new Date(TEST_DATE.getTime() - 100),
                        end: new Date(TEST_DATE.getTime() - 100),
                    }
                },
                notFinishedWorkouts: {11: 3},
                suggestedWorkouts: {},
                plannedWorkouts: []
            })
        })
        it('should add workout with active suggestion', () => {
            expect(exerciseReducer(STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION(), {
                type: 'ADD_WORKOUT',
                workout: {
                    exerciseId: 11,
                    notes: '',
                    sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}],
                    start: new Date(TEST_DATE.getTime() + 100)
                }
            })).toEqual({
                ...STATE_WITH_TWO_WORKOUTS(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                    3: {
                        id: 3,
                        exerciseId: 11,
                        notes: '',
                        start: new Date(TEST_DATE.getTime() + 100),
                        sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}]
                    }
                },
                allIds: [2, 1, 3],
                byExerciseId:
                    {
                        11: [1, 3],
                        22: [2],
                    }
                ,
                notFinishedWorkouts: {11: 3},
                suggestedWorkouts: {
                    11: {
                        exerciseId: 11,
                        id: undefined,
                        notes: "",
                        sets: [{reps: 2, rir: 2, weight: 2, date: undefined, index: 2}],
                        start: undefined,
                        end: undefined
                    }
                }
            })
        })
        it('should add workout with active suggestion', () => {
            expect(exerciseReducer(STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION(), {
                type: 'ADD_WORKOUT',
                workout: {
                    exerciseId: 11,
                    notes: '',
                    sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}],
                    start: new Date(TEST_DATE.getTime() + 100)
                }
            })).toEqual({
                ...STATE_WITH_TWO_WORKOUTS(),
                byId: {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                    3: {
                        id: 3,
                        exerciseId: 11,
                        notes: '',
                        start: new Date(TEST_DATE.getTime() + 100),
                        sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}]
                    }
                },
                allIds: [2, 1, 3],
                byExerciseId:
                    {
                        11: [1, 3],
                        22: [2],
                    }
                ,
                notFinishedWorkouts: {11: 3},
                suggestedWorkouts: {
                    11: {
                        exerciseId: 11,
                        id: undefined,
                        notes: "",
                        sets: [{reps: 2, rir: 2, weight: 2, date: undefined, index: 2}],
                        start: undefined,
                        end: undefined
                    }
                }
            })
        })
    })

    describe('ADD_SET_TO_WORKOUT', () => {
        it('should add workout with first index', () => {
            expect(exerciseReducer(STATE_WITH_TWO_WORKOUTS(), {
                type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
                set: {
                    reps: 1,
                    rir: 1,
                    weight: 1,
                    date: TEST_DATE,
                } as WorkoutSet,
                workoutId: 1
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS()
                    ,
                    byId: {
                        ...STATE_WITH_TWO_WORKOUTS().byId,
                        1: {
                            ...STATE_WITH_TWO_WORKOUTS().byId[1],
                            sets: [{reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1}]
                        }
                    }
                })
        });
        it('should add workout with existing set', () => {
            expect(exerciseReducer({
                ...STATE_WITH_TWO_WORKOUTS(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS().byId,
                    1: {
                        ...STATE_WITH_TWO_WORKOUTS().byId[1],
                        sets: [{reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1}]
                    }
                }
            }, {
                type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
                set: {
                    reps: 2,
                    rir: 2,
                    weight: 2,
                    date: TEST_DATE,
                } as WorkoutSet,
                workoutId: 1
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS(),
                    byId: {
                        ...STATE_WITH_TWO_WORKOUTS().byId,
                        1: {
                            ...STATE_WITH_TWO_WORKOUTS().byId[1],
                            sets: [
                                {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1},
                                {reps: 2, rir: 2, weight: 2, date: TEST_DATE, index: 2}
                            ]
                        }
                    }
                })
        })

        it('should update when index exsits in the set', () => {
            expect(exerciseReducer({
                ...STATE_WITH_TWO_WORKOUTS(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS().byId,
                    1: {
                        ...STATE_WITH_TWO_WORKOUTS().byId[1],
                        sets: [
                            {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 5}
                            , {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 8}
                        ]
                    }
                }
            }, {
                type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
                set: {
                    index: 5,
                    reps: 2,
                    rir: 2,
                    weight: 2,
                    date: TEST_DATE,
                } as WorkoutSet,
                workoutId: 1
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS(),
                    byId: {
                        ...STATE_WITH_TWO_WORKOUTS().byId,
                        1: {
                            ...STATE_WITH_TWO_WORKOUTS().byId[1],
                            sets: [
                                {reps: 2, rir: 2, weight: 2, date: TEST_DATE, index: 5}
                                , {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 8}
                            ]
                        }
                    }
                })
        })

        it('should add set to workout with active suggestion', () => {
            expect(exerciseReducer(({
                    ...STATE_WITH_TWO_WORKOUTS(), byId: {
                        ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                        3: {
                            id: 3,
                            exerciseId: 11,
                            notes: '',
                            start: new Date(TEST_DATE.getTime()),
                            sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}]
                        }
                    },
                    allIds: [2, 1, 3],
                    byExerciseId:
                        {
                            11: [1, 3],
                            22: [2],
                        }
                    ,
                    notFinishedWorkouts: {11: 3},
                    suggestedWorkouts: {
                        11: {
                            exerciseId: 11,
                            id: undefined,
                            notes: "",
                            sets: [{reps: 2, rir: 2, weight: 2, date: undefined, index: 2}],
                            start: undefined,
                            end: undefined
                        }
                    }
                })
                , {
                    type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
                    set: {
                        index: 2,
                        reps: 2,
                        rir: 2,
                        weight: 3,
                        date: TEST_DATE,
                    } as WorkoutSet,
                    workoutId: 3
                })).toEqual({
                ...STATE_WITH_TWO_WORKOUTS(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                    3: {
                        id: 3,
                        exerciseId: 11,
                        notes: '',
                        start: new Date(TEST_DATE.getTime()),
                        sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}, {
                            reps: 2,
                            rir: 2,
                            weight: 3,
                            date: TEST_DATE,
                            index: 2
                        }]
                    }
                },
                allIds: [2, 1, 3],
                byExerciseId:
                    {
                        11: [1, 3],
                        22: [2],
                    }
                ,
                notFinishedWorkouts: {11: 3},
                suggestedWorkouts: {}
            })
        })
        it('should add set to workout with active suggestion but not in suggestion', () => {
            expect(exerciseReducer(({
                    ...STATE_WITH_TWO_WORKOUTS(), byId: {
                        ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                        3: {
                            id: 3,
                            exerciseId: 11,
                            notes: '',
                            start: new Date(TEST_DATE.getTime()),
                            sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}]
                        }
                    },
                    allIds: [2, 1, 3],
                    byExerciseId:
                        {
                            11: [1, 3],
                            22: [2],
                        }
                    ,
                    notFinishedWorkouts: {11: 3},
                    suggestedWorkouts: {
                        11: {
                            exerciseId: 11,
                            id: undefined,
                            notes: "",
                            sets: [{reps: 2, rir: 2, weight: 2, date: undefined, index: 2}],
                            start: undefined,
                            end: undefined
                        }
                    }
                })
                , {
                    type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
                    set: {
                        index: 3,
                        reps: 3,
                        rir: 3,
                        weight: 3,
                        date: TEST_DATE,
                    } as WorkoutSet,
                    workoutId: 3
                })).toEqual({
                ...STATE_WITH_TWO_WORKOUTS(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                    3: {
                        id: 3,
                        exerciseId: 11,
                        notes: '',
                        start: new Date(TEST_DATE.getTime()),
                        sets: [{reps: 1, rir: 1, weight: 3, date: TEST_DATE, index: 1}, {
                            reps: 3,
                            rir: 3,
                            weight: 3,
                            date: TEST_DATE,
                            index: 3
                        }]
                    }
                },
                allIds: [2, 1, 3],
                byExerciseId:
                    {
                        11: [1, 3],
                        22: [2],
                    }
                ,
                notFinishedWorkouts: {11: 3},
                suggestedWorkouts: {
                    11: {
                        exerciseId: 11,
                        id: undefined,
                        notes: "",
                        sets: [{reps: 2, rir: 2, weight: 2, date: undefined, index: 2}],
                        start: undefined,
                        end: undefined
                    }
                }
            })
        })
    })

    describe('FINALIZE_WORKOUT', () => {
        it('should finalize workout', () => {
            expect(exerciseReducer({...STATE_WITH_TWO_WORKOUTS(), notFinishedWorkouts: {11: 1, 22: 2}}, {
                type: 'FINALIZE_WORKOUT',
                end: TEST_DATE,
                workoutId: 1
            })).toEqual({
                ...STATE_WITH_TWO_WORKOUTS(),
                byId: {
                    ...STATE_WITH_TWO_WORKOUTS().byId,
                    1: {
                        ...STATE_WITH_TWO_WORKOUTS().byId[1],
                        end: TEST_DATE
                    }
                },
                notFinishedWorkouts: {22: 2},
                suggestedWorkouts: {}
            })
        })
    })
    describe('DELETE_SET_FROM_WORKOUT', () => {
        it('should delete set from workout', () => {
            expect(exerciseReducer({
                ...STATE_WITH_TWO_WORKOUTS(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS().byId,
                    1: {
                        ...STATE_WITH_TWO_WORKOUTS().byId[1],
                        sets: [
                            {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 5}
                            , {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 8}
                        ]
                    }
                }
            }, {
                type: 'DELETE_SET_FROM_WORKOUT',
                set: {
                    index: 5,
                    reps: 2,
                    rir: 2,
                    weight: 2,
                    date: TEST_DATE,
                } as WorkoutSet,
                workoutId: 1
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS(),
                    byId: {
                        ...STATE_WITH_TWO_WORKOUTS().byId,
                        1: {
                            ...STATE_WITH_TWO_WORKOUTS().byId[1],
                            sets: [
                                {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 8}
                            ]
                        }
                    }
                })
        })
        it('should delete set from suggestions if unfinshed workout already persisted', () => {
            expect(exerciseReducer({
                ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION(), byId: {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                    3: {
                        ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId[1],
                        sets: [
                            {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1}
                        ]
                    }

                },
                suggestedWorkouts: {
                    11: {
                        exerciseId: 11,
                        id: undefined,
                        notes: "",
                        sets: [
                            {reps: 2, rir: 2, weight: 2, date: undefined, index: 2}
                        ],
                        start: undefined,
                        end: undefined
                    }
                }
            }, {
                type: 'DELETE_SET_FROM_WORKOUT',
                set: {
                    index: 2,
                    reps: 2,
                    rir: 2,
                    weight: 2,
                    date: TEST_DATE,
                } as WorkoutSet,
                workoutId: 3,
                exerciseId: 11
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION(), byId: {
                        ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId,
                        3: {
                            ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION().byId[1],
                            sets: [
                                {reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1}
                            ]
                        }

                    },
                    suggestedWorkouts: {},
                })
        })

        it('should delete set from suggestions if unfinshed workout not persisted', () => {
            expect(exerciseReducer({
                ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION()
            }, {
                type: 'DELETE_SET_FROM_WORKOUT',
                set: {
                    index: 2,
                    reps: 2,
                    rir: 2,
                    weight: 2,
                    date: TEST_DATE,
                } as WorkoutSet,
                workoutId: undefined,
                exerciseId: 11
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION(),
                    suggestedWorkouts: {
                        11: {
                            exerciseId: 11,
                            id: undefined,
                            notes: "",
                            sets: [
                                {reps: 1, rir: 1, weight: 1, date: undefined, index: 1}
                            ],
                            start: undefined,
                            end: undefined
                        }
                    }
                })
        })
    })

    describe('SUGGEST_WORKOUT', () => {
        it('should suggest workout', () => {
            expect(exerciseReducer({
                        ...STATE_WITH_TWO_WORKOUTS(),
                        byId:
                            {
                                ...
                                    STATE_WITH_TWO_WORKOUTS().byId,
                                1:
                                    {
                                        ...
                                            STATE_WITH_TWO_WORKOUTS().byId[1],
                                        sets:
                                            [{reps: 1, rir: 1, weight: 1, date: TEST_DATE, index: 1}, {
                                                reps: 2,
                                                rir: 2,
                                                weight: 2,
                                                date: TEST_DATE,
                                                index: 2
                                            }]
                                    }
                            }
                    }
                    , {
                        type: 'SUGGEST_WORKOUT',
                        exerciseId: 11
                    })
            ).toEqual(STATE_WITH_TWO_WORKOUTS_AND_ACTIVE_SUGGESTION())
        })
    })
    describe('DELETE_EXERCISE', () => {
        it('should delete all workouts connected to exercise', () => {
            expect(exerciseReducer({
                ...STATE_WITH_TWO_WORKOUTS(),
                notFinishedWorkouts: {
                    11: 1,
                    22: 2
                },
                suggestedWorkouts: {
                    11: {
                        exerciseId: 11,
                        id: undefined,
                        notes: "",
                        sets: [{reps: 2, rir: 2, weight: 2, date: undefined, index: 2}],
                        start: undefined,
                        end: undefined
                    }
                }
            }, {
                type: 'DELETE_EXERCISE',
                exerciseId: 11
            })).toEqual(
                {
                    ...STATE_WITH_TWO_WORKOUTS(),
                    byId: {
                        2: {
                            exerciseId: 22,
                            id: 2,
                            notes: "",
                            sets: [],
                            start: new Date(TEST_DATE.getTime() - 200),
                            end: new Date(TEST_DATE.getTime() - 200),
                        }
                    },
                    allIds: [2],
                    byExerciseId: {
                        22: [2]
                    },
                    notFinishedWorkouts: {
                        22: 2
                    },
                    suggestedWorkouts: {}
                })
        })
    })
})
