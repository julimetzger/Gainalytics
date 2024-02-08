import trainingsReducer from "../../../app/redux/Training/trainingsReducer";

describe('trainingsReducer', () => {
    describe('ADD_PLANED_TRAINING_WORKOUT', () => {
        it('it should add and create training if not present', () => {
            expect(trainingsReducer({
                byId: {},
                allIds: []
            }, {
                type: 'ADD_PLANED_TRAINING_WORKOUT',
                trainingsPlanId: 1,
                microNumber: 1,
                trainingInMicroNumber: 1,
                exerciseId: 2,
                workout: {
                    name: 'workout'
                },
                nextTrainingsId: 3,
                nextWorkoutId: 4
            })).toEqual({
                byId: {
                    3: {
                        id: 3,
                        exercises: [2],
                        doneWorkoutIds: {},
                        started: false,
                        finished: false,
                        plannedWorkouts: {
                            2: 4
                        }
                    }
                },
                allIds: [3]
            })
        })

        it('it should add workout to existing training', () => {
            expect(trainingsReducer({
                byId: {
                    3: {
                        id: 3,
                        exercises: [2],
                        plannedWorkouts: {},
                        doneWorkoutIds: {},
                        started: false,
                        finished: false,
                    }

                },
                allIds: [3]

            }, {
                type: 'ADD_PLANED_TRAINING_WORKOUT',
                trainingsPlanId: 1,
                microNumber: 1,
                trainingInMicroNumber: 1,
                exerciseId: 2,
                workout: {
                    name: 'workout'
                },
                nextTrainingsId: 5,
                nextWorkoutId: 4,
                trainingsId: 3
            })).toEqual({
                byId: {
                    3: {
                        id: 3,
                        exercises: [2],
                        doneWorkoutIds: {},
                        started: false,
                        finished: false,
                        plannedWorkouts: {
                            2: 4
                        }
                    },
                },
                allIds: [3]
            })
        })

    })
    describe('MODIFY_EXERCISES_IN_TRAINING', () => {
        it('it should modify exercises in training', () => {
            expect(trainingsReducer({
                byId: {
                    3: {
                        id: 3,
                        exercises: [2],
                        plannedWorkouts: {},
                        doneWorkoutIds: {},
                        started: false,
                        finished: false,
                    }

                },
                allIds: [3]

            }, {
                type: 'MODIFY_EXERCISES_IN_TRAINING',
                exercises: [2, 3],
                trainingsPlanId: 1,
                microNumber: 1,
                trainingInMicroNumber: 1,
                nextTrainingsId: 5,
                trainingsId: 3
            })).toEqual({
                byId: {
                    3: {
                        id: 3,
                        exercises: [2, 3],
                        plannedWorkouts: {},
                        doneWorkoutIds: {},
                        started: false,
                        finished: false,
                    }

                },
                allIds: [3]
            })
        })
        it('it should modify exercises and create Training if not present', () => {
            expect(trainingsReducer({
                byId: {},
                allIds: []
            }, {
                type: 'MODIFY_EXERCISES_IN_TRAINING',
                exercises: [2],
                trainingsPlanId: 1,
                microNumber: 1,
                trainingInMicroNumber: 1,
                nextTrainingsId: 5,
            })).toEqual({
                byId: {
                    5: {
                        id: 5,
                        exercises: [2],
                        plannedWorkouts: {},
                        doneWorkoutIds: {},
                        started: false,
                        finished: false,
                    }

                },
                allIds: [5]
            })
        })
    })
})
