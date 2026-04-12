import {getLastTrainingOfPreviousMeso} from '../trainingsPlanReducer';
import {Meso} from '../../../models/entities/TrainingsPlan';

describe('getLastTrainingOfPreviousMeso', () => {
  const mesos: Meso[] = [
    {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
    {id: 2, name: 'Meso 2', order: 2, startMicro: 5},
    {id: 3, name: 'Meso 3', order: 3, startMicro: 9},
  ];

  it('returns undefined when there is no previous meso (first meso)', () => {
    const trainings = {
      '1,1': 101,
      '2,1': 102,
    };
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 1, mesos)).toBeUndefined();
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 3, mesos)).toBeUndefined();
  });

  it('returns undefined when mesos array is undefined', () => {
    const trainings = {'1,1': 101};
    // With no mesos, getSortedMesos returns the default single meso, so there is no previous
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 1, undefined)).toBeUndefined();
  });

  it('returns the last training ID of the previous meso for the given trainingsNumber', () => {
    const trainings = {
      '1,1': 101,
      '2,1': 102,
      '3,1': 103,
      '4,1': 104, // last micro in Meso 1 (5-1=4)
      '5,1': 201, // first micro in Meso 2
      '6,1': 202,
    };
    // currentMicro=5 is in Meso 2; previous meso is Meso 1 (micros 1-4); last training in Meso 1 for training 1 is at micro 4 → id 104
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 5, mesos)).toBe(104);
    // currentMicro=6 is also in Meso 2; same result
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 6, mesos)).toBe(104);
  });

  it('returns undefined when the previous meso has no trainings for the given trainingsNumber', () => {
    const trainings = {
      '1,2': 201, // only training 2 exists in Meso 1
      '5,1': 501,
    };
    // No training 1 in Meso 1
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 5, mesos)).toBeUndefined();
  });

  it('works correctly when Meso 3 looks back at Meso 2', () => {
    const trainings = {
      '5,1': 501,
      '6,1': 502,
      '7,1': 503,
      '8,1': 504, // last micro in Meso 2 (9-1=8)
      '9,1': 601, // first micro in Meso 3
    };
    // currentMicro=9 is in Meso 3; previous meso is Meso 2 (micros 5-8); last is micro 8 → id 504
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 9, mesos)).toBe(504);
  });

  it('ignores trainings from a different trainingsNumber', () => {
    const trainings = {
      '1,1': 101,
      '2,1': 102,
      '3,2': 201, // trainingsNumber 2 — should be ignored when querying for trainingsNumber 1
      '5,1': 501,
    };
    expect(getLastTrainingOfPreviousMeso(trainings, 1, 5, mesos)).toBe(102);
  });
});
