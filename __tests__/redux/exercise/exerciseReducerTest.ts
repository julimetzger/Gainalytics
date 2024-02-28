import exerciseReducer from "../../../app/redux/exercises/exercisesReducer";

describe('exerciseReducer', () => {
    it('should add an exercise', () => {
        const initialState = {
            byId: {
                1: {
                    id: 1,
                    name: 'Bankdrücken',
                },
                2: {
                    id: 2,
                    name: 'Squat',
                },
                3: {
                    id: 3,
                    name: 'Deadlift',
                },
            },
            allIds: [1, 2, 3],
        };
        const action = {
            type: 'ADD_EXERCISE',
            nameOfExercise: 'Overhead Press',
            muscles: [{muscle: 'Bizeps', percent: 50}],
        };
        const expectedState = {
            byId: {
                1: {
                    id: 1,
                    name: 'Bankdrücken',
                },
                2: {
                    id: 2,
                    name: 'Squat',
                },
                3: {
                    id: 3,
                    name: 'Deadlift',
                },
                4: {
                    id: 4,
                    name: 'Overhead Press',
                    muscles: [{muscle: 'Bizeps', percent: 50}]
                },
            },
            allIds: [1, 2, 3, 4],
        };
        expect(exerciseReducer(initialState, action)).toEqual(expectedState);
    });
    it('should delete an exercise', () => {
        const initialState = {
            byId: {
                1: {
                    id: 1,
                    name: 'Bankdrücken',
                },
                2: {
                    id: 2,
                    name: 'Squat',
                },
                3: {
                    id: 3,
                    name: 'Deadlift',
                },
            },
            allIds: [1, 2, 3],
        };
        const action = {
            type: 'DELETE_EXERCISE',
            exerciseId: 2,
        };
        const expectedState = {
            byId: {
                1: {
                    id: 1,
                    name: 'Bankdrücken',
                },
                3: {
                    id: 3,
                    name: 'Deadlift',
                },
            },
            allIds: [1, 3],
        };
        expect(exerciseReducer(initialState, action)).toEqual(expectedState);
    });
    it('should edit an exercise', () => {
        const initialState = {
            byId: {
                1: {
                    id: 1,
                    name: 'Bankdrücken',
                },
                2: {
                    id: 2,
                    name: 'Squat',
                },
                3: {
                    id: 3,
                    name: 'Deadlift',
                },
            },
            allIds: [1, 2, 3],
        };
        const action = {
            type: 'EDIT_EXERCISE',
            exerciseId: 2,
            nameOfExercise: 'Front Squat',
            muscles: [{muscle: 'Bizeps', percent: 50}],
        };
        const expectedState = {
            byId: {
                1: {
                    id: 1,
                    name: 'Bankdrücken',
                },
                2: {
                    id: 2,
                    name: 'Front Squat',
                    muscles: [{muscle: 'Bizeps', percent: 50}]
                },
                3: {
                    id: 3,
                    name: 'Deadlift',
                },
            },
            allIds: [1, 2, 3],
        };
        expect(exerciseReducer(initialState, action)).toEqual(expectedState);

    })
    describe('default', () => {
        it('should return the initial state', () => {
            const initialState = {
                byId: {
                    1: {
                        id: 1,
                        name: 'Bankdrücken',
                    },
                    2: {
                        id: 2,
                        name: 'Squat',
                    },
                    3: {
                        id: 3,
                        name: 'Deadlift',
                    },
                },
                allIds: [1, 2, 3],
            };
            const action = {
                type: 'DEFAULT',
            };
            expect(exerciseReducer(initialState, action)).toEqual(initialState);
        });
    })
});
