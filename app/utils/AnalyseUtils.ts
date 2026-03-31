import {sum, sumBy} from 'lodash';
import {Comparison} from '../components/analyse/MetricsOverviewForWorkouts';
import {Muscles} from '../models/Muscles';
import {Exercise} from '../models/entities/Exercise';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {Workout} from '../models/entities/Workout';
import {Metric} from '../models/Metric';

export interface SuggestionProgressionProfile {
  rirDelta: number;
  weightIncreasePercent: number;
}

export const DEFAULT_SUGGESTION_PROGRESSION_PROFILE = {
  rirDelta: 1,
  weightIncreasePercent: 0,
} satisfies SuggestionProgressionProfile;

export const repetitionMax = (...workoutSet: WorkoutSet[]) => {
  let number = Math.max(...workoutSet.map((value) => value.weight * repsCoefficient(value.reps + value.rir)));
  return number !== -Infinity ? number : 0;
};

export const oneRepMaxForWorkouts = (...workout: Workout[]) => {
  return repetitionMax(...workout.flatMap((workout) => workout.sets));
};

function repsCoefficient(reps: number) {
  if (reps === 1) return 1;
  else return 1 + reps / 30;
}

export const repetitionWeightByOneRm = (reps: number, rir: number, oneRm: number) => {
  return oneRm / repsCoefficient(reps + rir);
};

export const calculateLinearProgressionWeight = (workoutSet: WorkoutSet, progressionProfile: SuggestionProgressionProfile) => {
  const sourceOneRm = repetitionMax(workoutSet);
  const adjustedRir = Math.max(workoutSet.rir - progressionProfile.rirDelta, 0);
  const suggestedWeight = repetitionWeightByOneRm(workoutSet.reps, adjustedRir, sourceOneRm);
  const weightWithIncrease = suggestedWeight * (1 + progressionProfile.weightIncreasePercent / 100);
  return Math.round(weightWithIncrease);
};

export const applyLinearProgressionToWorkout = (workout: Workout, progressionProfile: SuggestionProgressionProfile): Workout => {
  if (workout.sets.some((set) => set.rir === 0)) {
    return {
      ...workout,
      sets: workout.sets.map((set) => ({...set})),
    };
  }

  return {
    ...workout,
    sets: workout.sets.map((set) => {
      const adjustedRir = Math.max(set.rir - progressionProfile.rirDelta, 0);
      return {
        ...set,
        rir: adjustedRir,
        weight: calculateLinearProgressionWeight(set, progressionProfile),
      };
    }),
  };
};

export function calculateMetricValue(sets: WorkoutSet[], metric: Metric) {
  const oneRm = repetitionMax(...sets)?.valueOf();
  switch (metric) {
    case Metric.ONE_RM:
      return oneRm;
    case Metric.VOLUME:
      return sumBy(sets, (value) => value.weight * value.reps);
    case Metric.MAX_INTENSITY:
      return oneRm ? Math.max(...sets.map((value) => value.weight / oneRm)) * 100 : 100;
    case Metric.AVERAGE_INTENSITY:
      return oneRm ? (sumBy(sets, (value) => value.weight) / sets.length / oneRm) * 100 : 100;
    case Metric.SETS:
      return sets.length;
    case Metric.REPS:
      return sumBy(sets, (value) => value.reps);
  }
}

export function calculateMetricValueForMuscles(exerxiseWorkoutMap: Map<Exercise, WorkoutSet[]>, metric: Metric, muscle: Muscles) {
  let sets = Array.from(exerxiseWorkoutMap.values()).flat();
  const oneRm = repetitionMax(...sets)?.valueOf();
  switch (metric) {
    case Metric.ONE_RM:
      return oneRm;
    case Metric.VOLUME:
      let collection = Array.from(exerxiseWorkoutMap.entries()).map(([exercise, workoutSets]) =>
        sumBy(workoutSets, (value) => {
          return (value.weight * value.reps * (exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0)) / 100;
        }),
      );
      return sum(collection);
    case Metric.MAX_INTENSITY:
      return oneRm ? Math.max(...sets.map((value) => value.weight / oneRm)) * 100 : 100;
    case Metric.AVERAGE_INTENSITY:
      return oneRm ? (sumBy(sets, (value) => value.weight) / sets.length / oneRm) * 100 : 100;
    case Metric.SETS:
      return sum(Array.from(exerxiseWorkoutMap.entries()).map(([exercise, workoutSets]) => sumBy(workoutSets, (value) => exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0) / 100));
    case Metric.REPS:
      return sum(
        Array.from(exerxiseWorkoutMap.entries()).map(([exercise, workoutSets]) =>
          sumBy(workoutSets, (value) => ((exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0) / 100) * value.reps),
        ),
      );
  }
}

export function calculateMetricComparisons(workout: WorkoutSetMap): Map<Metric, Comparison> {
  let metricComparison = new Map<Metric, Comparison>();
  Object.values(Metric).forEach((metric) => {
    let current = calculateMetricValue(workout.currentWorkoutSets, metric)!!;
    let last = (workout.lastWorkoutSets?.length ?? 0) > 0 ? calculateMetricValue(workout.lastWorkoutSets ?? [], metric) : undefined;
    let difference = last ? current - last : undefined;
    metricComparison.set(metric, {value: current, difference: difference});
  });
  return metricComparison;
}

export function calculateMetricComparisonsForMuscle(workout: Map<Exercise, WorkoutSetMap>): Map<Muscles, Map<Metric, Comparison>> {
  let exerciseWorkoutMap: ExerciseWorkoutSetMap = {
    currentWorkoutSets: new Map<Exercise, WorkoutSet[]>(),
    lastWorkoutSets: new Map<Exercise, WorkoutSet[]>(),
  };
  Array.from(workout.entries()).forEach(([exercise, workoutSetMap]) => {
    exerciseWorkoutMap.currentWorkoutSets.set(exercise, workoutSetMap.currentWorkoutSets);
    exerciseWorkoutMap?.lastWorkoutSets?.set(exercise, workoutSetMap.lastWorkoutSets ?? []);
  });
  let muscles = [
    ...new Set(
      Array.from(workout.keys())
        .map((exercise: Exercise) => exercise.muscles)
        .filter((muscle) => muscle !== undefined)
        .flat()
        .map((muscle) => muscle!!.muscle),
    ),
  ] as Muscles[];
  let muscleMetricComparison = new Map<Muscles, Map<Metric, Comparison>>();
  muscles.map((muscle) => {
    let metricComparison = new Map<Metric, Comparison>();
    Object.values(Metric).forEach((metric) => {
      let current = calculateMetricValueForMuscles(exerciseWorkoutMap.currentWorkoutSets, metric, muscle)!!;
      let last = (exerciseWorkoutMap.lastWorkoutSets?.size ?? 0) > 0 ? calculateMetricValueForMuscles(exerciseWorkoutMap.lastWorkoutSets ?? new Map(), metric, muscle) : undefined;
      let difference = last ? current - last : undefined;
      metricComparison.set(metric, {value: current, difference: difference});
    });
    muscleMetricComparison.set(muscle, metricComparison);
  });
  return muscleMetricComparison;
}

export interface WorkoutSetMap {
  currentWorkoutSets: WorkoutSet[];
  lastWorkoutSets?: WorkoutSet[];
}

export interface ExerciseWorkoutSetMap {
  currentWorkoutSets: Map<Exercise, WorkoutSet[]>;
  lastWorkoutSets?: Map<Exercise, WorkoutSet[]>;
}
