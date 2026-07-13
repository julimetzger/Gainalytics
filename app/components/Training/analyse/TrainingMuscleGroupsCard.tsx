import React, {useMemo} from 'react';
import {Workout} from '../../../models/entities/Workout';
import {Exercise} from '../../../models/entities/Exercise';
import {useExerciseByIds} from '../../../redux/Exercises/use/useExerciseByIds';
import {calculateMetricComparisonsForMuscle, WorkoutSetMap} from '../../../utils/AnalyseUtils';
import MuscleHeatmap from '../../../tabs/Analyse/dashboard/MuscleHeatmap';

interface TrainingMuscleGroupsCardProps {
  trainingsWorkouts: Workout[];
  previousWorkouts?: Workout[];
}

/**
 * "Muscle Groups" section for a single training's Analysis view — reuses the same
 * MuscleHeatmap presentation and calculateMetricComparisonsForMuscle calculation that
 * power the global Analyse tab's dashboard (GH-367), scoped to this training's workouts.
 */
const TrainingMuscleGroupsCard = ({trainingsWorkouts, previousWorkouts = []}: TrainingMuscleGroupsCardProps) => {
  const exerciseIds = useMemo(
    () => [...new Set([...trainingsWorkouts, ...previousWorkouts].map((workout) => workout.exerciseId))],
    [trainingsWorkouts, previousWorkouts],
  );
  const exercises = useExerciseByIds(exerciseIds).filter(Boolean) as Exercise[];

  const exerciseWorkoutMap = useMemo(() => {
    return new Map(
      exercises.map((exercise) => {
        const currentWorkouts = trainingsWorkouts.filter((workout) => workout.exerciseId === exercise.id);
        const lastWorkouts = previousWorkouts.filter((workout) => workout.exerciseId === exercise.id);
        return [
          exercise,
          {
            currentWorkoutSets: currentWorkouts.flatMap((workout) => workout.sets),
            lastWorkoutSets: lastWorkouts.flatMap((workout) => workout.sets),
          } satisfies WorkoutSetMap,
        ] as const;
      }),
    );
  }, [exercises, trainingsWorkouts, previousWorkouts]);

  const muscleMetricMap = useMemo(() => calculateMetricComparisonsForMuscle(exerciseWorkoutMap), [exerciseWorkoutMap]);

  return <MuscleHeatmap muscleMetricMap={muscleMetricMap} onMusclePress={() => undefined} />;
};

export default TrainingMuscleGroupsCard;
