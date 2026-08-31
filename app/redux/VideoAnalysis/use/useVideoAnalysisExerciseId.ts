import {VideoAnalysis} from '../../../models/entities/VideoAnalysis';
import {useWorkoutById} from '../../Workout/use/useWorkoutById';

/**
 * The exercise an analysis belongs to. An analysis carries its own `exerciseId` only when
 * it was imported standalone; one filmed inside a session is linked through its workout.
 * Every consumer must resolve it the same way, or the same analysis shows a VL reference
 * in one place and the global curve in another (issue #316).
 */
export const useVideoAnalysisExerciseId = (analysis?: VideoAnalysis): number | undefined => {
  const workout = useWorkoutById(analysis?.workoutId);
  return analysis?.exerciseId ?? workout?.exerciseId;
};
