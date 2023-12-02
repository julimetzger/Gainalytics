import exerciseReducer from "../../../app/redux/Workout/workoutReducer";

describe('workoutReducer', () => {
        it('should add workout', () => {
            expect(exerciseReducer(undefined, {
                type: 'ADD_WORKOUT',
                workout: {id: 1, exerciseId: 1, notes: '', sets: []}
            })).toEqual({})
        })
    }
)
;
