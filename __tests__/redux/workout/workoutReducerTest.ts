import exerciseReducer from "../../../app/redux/Workout/workoutReducer";

const TEST_DATE = new Date(2020, 1, 1, 1, 1, 2);
const STATE_WITH_TWO_WORKOUTS = () => {
    return {
        allIds: [2, 1],
        byExerciseId:
            {
                1: [1],
                2: [2],
            }
        ,
        byId: {
            1: {
                exerciseId: 1,
                id: 1,
                notes: "",
                sets: [],
                start: TEST_DATE,
                end: TEST_DATE,
            }, 2: {
                exerciseId: 2,
                id: 2,
                notes: "",
                sets: [],
                start: new Date(TEST_DATE.getTime() - 200),
                end: new Date(TEST_DATE.getTime() - 200),
            },
        },
    }
};
const EMPTY_STATE = {
    byId: {},
    allIds: [],
    byExerciseId: {}
};
describe('workoutReducer', () => {
    describe('ADD_WORKOUT', () => {
        it('should add workout', () => {
            expect(exerciseReducer({...EMPTY_STATE}, {
                type: 'ADD_WORKOUT',
                workout: {exerciseId: 1, notes: '', sets: [], start: TEST_DATE, end: TEST_DATE}
            })).toEqual({
                allIds: [1],
                byExerciseId:
                    {"1": [1,]}
                ,
                byId: {
                    1: {
                        exerciseId: 1,
                        id: 1,
                        notes: "",
                        sets: [],
                        start: TEST_DATE,
                        end: TEST_DATE,
                    }
                },
                notFinishedWorkouts: {1: 1}
            })
        })

        it('should add workout in timer ordered', () => {
            expect(exerciseReducer(STATE_WITH_TWO_WORKOUTS(), {
                type: 'ADD_WORKOUT',
                workout: {
                    exerciseId: 1,
                    notes: '',
                    sets: [],
                    start: new Date(TEST_DATE.getTime() - 100),
                    end: new Date(TEST_DATE.getTime() - 100)
                }
            })).toEqual({
                allIds: [2, 3, 1],
                byExerciseId:
                    {
                        1: [3, 1],
                        2: [2],
                    }
                ,
                byId: {
                    1: {
                        exerciseId: 1,
                        id: 1,
                        notes: "",
                        sets: [],
                        start: TEST_DATE,
                        end: TEST_DATE,
                    },
                    2: {
                        exerciseId: 2,
                        id: 2,
                        notes: "",
                        sets: [],
                        start: new Date(TEST_DATE.getTime() - 200),
                        end: new Date(TEST_DATE.getTime() - 200),
                    },
                    3: {
                        exerciseId: 1,
                        id: 3,
                        notes: "",
                        sets: [],
                        start: new Date(TEST_DATE.getTime() - 100),
                        end: new Date(TEST_DATE.getTime() - 100),
                    }
                },
                notFinishedWorkouts: {1: 3}
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
})
