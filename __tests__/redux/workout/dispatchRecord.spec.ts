import {dispatchRecord} from '../../../app/redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {Record} from '../../../app/models/entities/Exercise';

// weight=100, reps=7, rir=0 → 100 * (1 + 7/30) ≈ 123.33333333333334 (float artifact)
const FLOAT_SET = {weight: 100, reps: 7, rir: 0, index: 1, date: new Date()};
const FLOAT_1RM = 100 * (1 + 7 / 30); // 123.33333333333334

describe('dispatchRecord — 1RM rounding', () => {
  it('rounds ADD_RECORD value to max 2 decimal places', () => {
    const dispatch = jest.fn();
    const exercise = {id: 10, name: 'Test', records: {[Record.ONE_RM]: [{value: 100, workoutId: 3}]}};
    const workout = {id: 5, exerciseId: 10, sets: [], notes: '', start: new Date(), end: new Date()};

    dispatchRecord(false, FLOAT_SET, workout as any, dispatch, exercise as any, 5);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe('ADD_RECORD');
    expect(action.value).toBe(parseFloat(FLOAT_1RM.toFixed(2)));
    expect(String(action.value)).not.toMatch(/\d{5,}/); // no long decimal chain
  });

  it('rounds UPDATE_RECORD value when increasing record', () => {
    const dispatch = jest.fn();
    const exercise = {id: 10, name: 'Test', records: {[Record.ONE_RM]: [{value: 110, workoutId: 5}]}};
    const workout = {id: 5, exerciseId: 10, sets: [], notes: '', records: {[Record.ONE_RM]: 110}, start: new Date(), end: new Date()};

    dispatchRecord(false, FLOAT_SET, workout as any, dispatch, exercise as any, 5);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe('UPDATE_RECORD');
    expect(action.value).toBe(parseFloat(FLOAT_1RM.toFixed(2)));
    expect(String(action.value)).not.toMatch(/\d{5,}/);
  });

  it('rounds UPDATE_RECORD value when lowering record (float artifact case)', () => {
    // workout has record of 130 from a set at index 1 (weight=130, reps=1, rir=0).
    // We update index 1 with FLOAT_SET (weight=100, reps=7, rir=0 → 1RM ≈ 123.33333...).
    // After replacement newWorkoutSets = [FLOAT_SET], newOneRm ≈ 123.33333..., must be stored as 123.33.
    const dispatch = jest.fn();
    const exercise = {
      id: 10,
      name: 'Test',
      records: {
        [Record.ONE_RM]: [
          {value: 110, workoutId: 3},
          {value: 130, workoutId: 5},
        ],
      },
    };
    // existingSet uses the same index as FLOAT_SET so it gets replaced in newWorkoutSets
    const existingSet = {weight: 130, reps: 1, rir: 0, index: 1, date: new Date()};
    const workout = {
      id: 5,
      exerciseId: 10,
      sets: [existingSet],
      notes: '',
      records: {[Record.ONE_RM]: 130},
      start: new Date(),
      end: new Date(),
    };

    dispatchRecord(false, FLOAT_SET, workout as any, dispatch, exercise as any, 5);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe('UPDATE_RECORD');
    // 128.7999999999998-style artifacts must not reach storage
    expect(action.value).toBe(parseFloat(FLOAT_1RM.toFixed(2)));
    expect(String(action.value)).not.toMatch(/\.\d{5,}/); // no >4 decimal digits
  });

  it('preserves clean integer values (100 kg stays 100)', () => {
    const dispatch = jest.fn();
    const cleanSet = {weight: 100, reps: 1, rir: 0, index: 1, date: new Date()};
    const exercise = {id: 10, name: 'Test', records: {[Record.ONE_RM]: [{value: 90, workoutId: 3}]}};
    const workout = {id: 5, exerciseId: 10, sets: [], notes: '', start: new Date(), end: new Date()};

    dispatchRecord(false, cleanSet, workout as any, dispatch, exercise as any, 5);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].value).toBe(100);
  });

  it('preserves 2-decimal values (86.67 stays 86.67)', () => {
    const dispatch = jest.fn();
    // weight=78, reps=3, rir=0 → 78 * 1.1 = 85.8 (no artifact here)
    // Use a value that already has exactly 2 decimals
    const exercise = {id: 10, name: 'Test', records: {[Record.ONE_RM]: [{value: 80, workoutId: 3}]}};
    const workout = {id: 5, exerciseId: 10, sets: [], notes: '', start: new Date(), end: new Date()};
    // weight=78.3, reps=1, rir=0 → 1RM = 78.3 exactly (reps=1 → coefficient=1)
    const exactSet = {weight: 86.67, reps: 1, rir: 0, index: 1, date: new Date()};

    dispatchRecord(false, exactSet, workout as any, dispatch, exercise as any, 5);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].value).toBe(86.67);
  });
});
