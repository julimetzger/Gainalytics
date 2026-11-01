import {trainingProgress} from '../../app/utils/training-progress';

describe('GH-623 trainingProgress', () => {
  it('names the next open exercise after the selected one', () => {
    expect(trainingProgress([1, 2, 3, 4], [], 1)).toEqual({currentPosition: 1, total: 4, completedCount: 0, allCompleted: false, nextExerciseId: 2});
  });

  it('skips completed exercises and wraps around to open ones before the selected one', () => {
    expect(trainingProgress([1, 2, 3, 4], [1, 4], 3)).toEqual({currentPosition: 3, total: 4, completedCount: 2, allCompleted: false, nextExerciseId: 2});
  });

  it('has no next exercise when the selected one is the last open one', () => {
    expect(trainingProgress([1, 2, 3], [1, 2], 3)).toEqual({currentPosition: 3, total: 3, completedCount: 2, allCompleted: false, nextExerciseId: undefined});
  });

  it('is all completed only when every exercise is completed', () => {
    expect(trainingProgress([1, 2], [1, 2, 9], 2)).toEqual({currentPosition: 2, total: 2, completedCount: 2, allCompleted: true, nextExerciseId: undefined});
    expect(trainingProgress([], [], undefined)).toEqual({currentPosition: 0, total: 0, completedCount: 0, allCompleted: false, nextExerciseId: undefined});
  });

  it('starts from the first exercise when nothing is selected', () => {
    expect(trainingProgress([5, 6], [5], undefined)).toEqual({currentPosition: 0, total: 2, completedCount: 1, allCompleted: false, nextExerciseId: 6});
  });
});
