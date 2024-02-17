import trainingsPlanReducer from "../../../app/redux/Training/trainingsPlanReducer";

function ONE_TRAININGS_PLAN() {
    return {
        byId: {
            1: {
                id: 1,
                name: 'plan',
                trainings: {}
            }
        },
        allIds: [1]
    };
}

describe('trainingsPlanReducer', () => {
    describe('ADD_TRAININGS_PLAN', () => {
        it('it should add first trainings plan', () => {
            expect(trainingsPlanReducer({
                    byId: {}
                    ,
                    allIds: []
                }, {
                    type: 'ADD_TRAININGS_PLAN',
                    trainingsPlan: {
                        name: 'plan'
                    }
                })
            ).toEqual(ONE_TRAININGS_PLAN())
        })
        it('it should add further trainings plan', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'ADD_TRAININGS_PLAN',
                    trainingsPlan: {
                        name: 'plan'
                    }
                })
            ).toEqual({
                byId: {
                    1: {
                        id: 1,
                        name: 'plan',
                        trainings: {}
                    },
                    2: {
                        id: 2,
                        name: 'plan',
                        trainings: {}
                    }
                },
                allIds: [1, 2]
            })
        })
    })
    describe('EDIT_TRAININGS_PLAN', () => {
        it('should edit trainings plan', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'EDIT_TRAININGS_PLAN',
                    trainingsPlanId: 1,
                    name: 'new name'
                })
            ).toEqual({
                byId: {
                    1: {
                        id: 1,
                        name: 'new name',
                        trainings: {}
                    }
                },
                allIds: [1]
            })
        });
    })
    describe('DELETE_TRAININGS_PLAN', () => {
        it('should delete trainings plan', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'DELETE_TRAININGS_PLAN',
                    trainingsPlanId: 1
                })
            ).toEqual({
                byId: {},
                allIds: []
            })
        });
    })
    describe('ADD_PLANED_TRAINING_WORKOUT', () => {
        it('should ignore if training exists', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'ADD_PLANED_TRAINING_WORKOUT',
                    trainingsPlanId: 1,
                    microNumber: 1,
                    trainingInMicroNumber: 1,
                    trainingsId: 1,
                    nextTrainingsId: 2
                })
            ).toEqual(ONE_TRAININGS_PLAN())
        });
        it('should add planned training workout', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'ADD_PLANED_TRAINING_WORKOUT',
                    trainingsPlanId: 1,
                    microNumber: 1,
                    trainingInMicroNumber: 1,
                    nextTrainingsId: 2
                })
            ).toEqual({
                byId: {
                    1: {
                        id: 1,
                        name: 'plan',
                        trainings: {
                            '1,1': 2
                        }
                    }
                },
                allIds: [1]
            })
        });
    })
    describe('MODIFY_EXERCISES_IN_TRAINING', () => {
        it('should ignore if training exists', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'MODIFY_EXERCISES_IN_TRAINING',
                    trainingsPlanId: 1,
                    microNumber: 1,
                    trainingInMicroNumber: 1,
                    trainingsId: 1,
                    nextTrainingsId: 2
                })
            ).toEqual(ONE_TRAININGS_PLAN())
        });
        it('should add planned training workout', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                    type: 'MODIFY_EXERCISES_IN_TRAINING',
                    trainingsPlanId: 1,
                    microNumber: 1,
                    trainingInMicroNumber: 1,
                    nextTrainingsId: 2
                })
            ).toEqual({
                byId: {
                    1: {
                        id: 1,
                        name: 'plan',
                        trainings: {
                            '1,1': 2
                        }
                    }
                },
                allIds: [1]
            })
        });
    })
    describe('Default', () => {
        it('should not modify for unknown action type', () => {
            expect(trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
                type: 'UNKNOWN'
            })).toEqual(ONE_TRAININGS_PLAN())
        })
    })
})
