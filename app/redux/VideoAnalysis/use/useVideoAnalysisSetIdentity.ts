import {VideoAnalysis} from '../../../models/entities/VideoAnalysis';
import {formatVideoAnalysisSetIdentity} from '../../../utils/video-analysis-presentation';
import {useExercise} from '../../Exercises/use/useExercise';
import {useWorkoutById} from '../../Workout/use/useWorkoutById';

/**
 * Human readable identity of an analysis — the set it was filmed on rather than
 * its running id. Used by the compare picker and the analysis detail header.
 */
export const useVideoAnalysisSetIdentity = (analysis?: VideoAnalysis): string => {
  const workout = useWorkoutById(analysis?.workoutId);
  const exercise = useExercise(analysis?.exerciseId ?? workout?.exerciseId);
  // setIndex holds the user facing (1-based) set number, not an array position.
  const linkedSet = analysis?.setIndex !== undefined ? workout?.sets.find((set) => set.index === analysis.setIndex) : undefined;

  return formatVideoAnalysisSetIdentity({
    exerciseName: exercise?.name,
    setNumber: linkedSet ? linkedSet.index : undefined,
    weight: linkedSet?.weight,
    rir: linkedSet?.rir,
  });
};
