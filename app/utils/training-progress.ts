/**
 * GH-623: where a running training stands — drives the Train tab's action bar.
 *
 * An exercise counts as completed once its workout in this training is finalized
 * ("Next" / the former "Add Workout" sets the workout's `end`). Logged sets alone do
 * not complete it: the user may still be working on that exercise.
 */
export interface TrainingProgress {
  /** 1-based position of the selected exercise, 0 when nothing is selected. */
  currentPosition: number;
  total: number;
  completedCount: number;
  /** Every exercise of the training is completed (and there is at least one). */
  allCompleted: boolean;
  /** The first open exercise after the selected one (wrapping around), never the selected one itself. */
  nextExerciseId?: number;
}

export const trainingProgress = (exerciseIds: number[], completedExerciseIds: number[], chosenExerciseId?: number): TrainingProgress => {
  const completed = exerciseIds.filter((id) => completedExerciseIds.includes(id));
  const chosenIndex = chosenExerciseId !== undefined ? exerciseIds.indexOf(chosenExerciseId) : -1;
  const ordered = [...exerciseIds.slice(chosenIndex + 1), ...exerciseIds.slice(0, Math.max(chosenIndex, 0))];
  return {
    currentPosition: chosenIndex + 1,
    total: exerciseIds.length,
    completedCount: completed.length,
    allCompleted: exerciseIds.length > 0 && completed.length === exerciseIds.length,
    nextExerciseId: ordered.find((id) => id !== chosenExerciseId && !completedExerciseIds.includes(id)),
  };
};
