import exerciseReducer from "../../../app/redux/Workout/workoutReducer";

const TEST_DATE = new Date(2020, 1, 1, 1, 1, 2);
describe('workoutReducer', () => {
        it('should add workout', () => {
            expect(exerciseReducer({
                byId: {},
                allIds: [],
                byExerciseId: {}
            }, {
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
                }
            })
        })

        it('should add workout in timer ordered', () => {
            expect(exerciseReducer({
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
            }, {
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
                }
            })
        })
    }
)
;
