import {
  applyLinearProgressionToWorkout,
  calculateLinearProgressionWeight,
  SuggestionProgressionProfile,
} from '../../app/utils/AnalyseUtils';
import {Workout} from '../../app/models/entities/Workout';
import {WorkoutSet} from '../../app/models/entities/WorkoutSet';

describe('AnalyseUtils linear progression helpers', () => {
  it('calculates progressed weight from the estimated 1RM formula and rounds to whole kilograms', () => {
    const sourceSet = {
      index: 1,
      reps: 5,
      rir: 2,
      weight: 100,
    } satisfies WorkoutSet;
    const progressionProfile = {
      rirDelta: 1,
      weightIncreasePercent: 5,
    } satisfies SuggestionProgressionProfile;

    expect(calculateLinearProgressionWeight(sourceSet, progressionProfile)).toBe(108);
  });

  it('applies linear progression while preserving set order and count', () => {
    const sourceWorkout = {
      id: 10,
      exerciseId: 7,
      notes: 'source',
      sets: [
        {index: 1, reps: 5, rir: 2, weight: 100},
        {index: 2, reps: 3, rir: 1, weight: 120},
      ],
    } satisfies Workout;
    const progressionProfile = {
      rirDelta: 1,
      weightIncreasePercent: 0,
    } satisfies SuggestionProgressionProfile;

    expect(applyLinearProgressionToWorkout(sourceWorkout, progressionProfile)).toEqual({
      id: 10,
      exerciseId: 7,
      notes: 'source',
      sets: [
        {index: 1, reps: 5, rir: 1, weight: 103},
        {index: 2, reps: 3, rir: 0, weight: 124},
      ],
    });
  });

  it('skips progression for an exercise when any source set already has rir 0', () => {
    const sourceWorkout = {
      id: 11,
      exerciseId: 8,
      notes: 'source',
      sets: [
        {index: 1, reps: 5, rir: 1, weight: 100},
        {index: 2, reps: 3, rir: 0, weight: 120},
      ],
    } satisfies Workout;
    const progressionProfile = {
      rirDelta: 1,
      weightIncreasePercent: 10,
    } satisfies SuggestionProgressionProfile;

    expect(applyLinearProgressionToWorkout(sourceWorkout, progressionProfile)).toEqual(sourceWorkout);
  });
});
