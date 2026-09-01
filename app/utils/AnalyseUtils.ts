import {sum, sumBy} from 'lodash';
import {Comparison} from '../components/analyse/MetricsOverviewForWorkouts';
import {Muscles} from '../models/Muscles';
import {Exercise} from '../models/entities/Exercise';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {Workout} from '../models/entities/Workout';
import {Metric} from '../models/Metric';
import {evaluationReps, evaluationRir, evaluationWeight, mapPlannedSetBounds} from './planRange';

export interface SuggestionProgressionProfile {
  rirDelta: number;
  weightIncreasePercent: number;
}

export const DEFAULT_SUGGESTION_PROGRESSION_PROFILE = {
  rirDelta: 1,
  weightIncreasePercent: 0,
} satisfies SuggestionProgressionProfile;

export const repetitionMax = (...workoutSet: WorkoutSet[]) => {
  // GH-63: planned ranges count with their lower bound — read through planRange
  // so the rule lives in exactly one place.
  let number = Math.max(...workoutSet.map((value) => evaluationWeight(value) * repsCoefficient(evaluationReps(value) + evaluationRir(value))));
  return number !== -Infinity ? number : 0;
};

export const oneRepMaxForWorkouts = (...workout: Workout[]) => {
  return repetitionMax(...workout.flatMap((workout) => workout.sets));
};

export function repsCoefficient(reps: number) {
  if (reps === 1) return 1;
  else return 1 + reps / 30;
}

export const epley1RM = (weight: number, reps: number, rir: number) => {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || !Number.isFinite(rir)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  return weight * repsCoefficient(reps + rir);
};

export const repetitionWeightByOneRm = (reps: number, rir: number, oneRm: number) => {
  return oneRm / repsCoefficient(reps + rir);
};

export const calculateLinearProgressionWeight = (workoutSet: WorkoutSet, progressionProfile: SuggestionProgressionProfile) => {
  const sourceOneRm = repetitionMax(workoutSet);
  const adjustedRir = Math.max(evaluationRir(workoutSet) - progressionProfile.rirDelta, 0);
  const suggestedWeight = repetitionWeightByOneRm(evaluationReps(workoutSet), adjustedRir, sourceOneRm);
  const weightWithIncrease = suggestedWeight * (1 + progressionProfile.weightIncreasePercent / 100);
  return Math.round(weightWithIncrease);
};

const progressSingleValueSet = (workoutSet: WorkoutSet, progressionProfile: SuggestionProgressionProfile): WorkoutSet => ({
  ...workoutSet,
  rir: Math.max(workoutSet.rir - progressionProfile.rirDelta, 0),
  weight: calculateLinearProgressionWeight(workoutSet, progressionProfile),
});

export const applyLinearProgressionToWorkout = (workout: Workout, progressionProfile: SuggestionProgressionProfile): Workout => {
  if (workout.sets.some((set) => set.rir === 0)) {
    return {
      ...workout,
      sets: workout.sets.map((set) => ({...set})),
    };
  }

  return {
    ...workout,
    // GH-63: a planned range must survive the suggestion. mapPlannedSetBounds runs
    // the identical progression over the upper bound too, so weight and RIR ranges
    // move as a whole; a set without a range takes the plain single-value path.
    sets: workout.sets.map((set) => mapPlannedSetBounds(set, (bounds) => progressSingleValueSet(bounds, progressionProfile))),
  };
};

export function calculateMetricValue(sets: WorkoutSet[], metric: Metric, workoutsCount?: number) {
  const oneRm = repetitionMax(...sets)?.valueOf();
  switch (metric) {
    case Metric.ONE_RM:
      return oneRm;
    case Metric.VOLUME:
      return sumBy(sets, (value) => evaluationWeight(value) * evaluationReps(value));
    case Metric.MAX_INTENSITY:
      return oneRm ? Math.max(...sets.map((value) => evaluationWeight(value) / oneRm)) * 100 : 100;
    case Metric.AVERAGE_INTENSITY:
      return oneRm ? (sumBy(sets, (value) => evaluationWeight(value)) / sets.length / oneRm) * 100 : 100;
    case Metric.SETS:
      return sets.length;
    case Metric.REPS:
      return sumBy(sets, (value) => evaluationReps(value));
    case Metric.FREQUENCY:
      // workoutsCount is required for a meaningful result, but we return 0 when
      // called from highlight-mode paths that lack a per-period count (GH-169).
      return workoutsCount ?? 0;
  }
}

export function calculateMetricValueForMuscles(exerxiseWorkoutMap: Map<Exercise, WorkoutSet[]>, metric: Metric, muscle: Muscles, workoutsCounts?: Map<Exercise, number>) {
  let sets = Array.from(exerxiseWorkoutMap.values()).flat();
  const oneRm = repetitionMax(...sets)?.valueOf();
  switch (metric) {
    case Metric.ONE_RM:
      return oneRm;
    case Metric.VOLUME:
      let collection = Array.from(exerxiseWorkoutMap.entries()).map(([exercise, workoutSets]) =>
        sumBy(workoutSets, (value) => {
          return (evaluationWeight(value) * evaluationReps(value) * (exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0)) / 100;
        }),
      );
      return sum(collection);
    case Metric.MAX_INTENSITY:
      return oneRm ? Math.max(...sets.map((value) => evaluationWeight(value) / oneRm)) * 100 : 100;
    case Metric.AVERAGE_INTENSITY:
      return oneRm ? (sumBy(sets, (value) => evaluationWeight(value)) / sets.length / oneRm) * 100 : 100;
    case Metric.SETS:
      return sum(Array.from(exerxiseWorkoutMap.entries()).map(([exercise, workoutSets]) => sumBy(workoutSets, (value) => exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0) / 100));
    case Metric.REPS:
      return sum(
        Array.from(exerxiseWorkoutMap.entries()).map(([exercise, workoutSets]) =>
          sumBy(workoutSets, (value) => ((exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0) / 100) * evaluationReps(value)),
        ),
      );
    case Metric.FREQUENCY:
      return sum(
        Array.from(exerxiseWorkoutMap.entries()).map(([exercise]) => {
          const count = workoutsCounts?.get(exercise) ?? 0;
          return count * ((exercise.muscles?.find((m) => m.muscle === muscle)?.percent ?? 0) / 100);
        }),
      );
  }
}

export function calculateMetricComparisons(workout: WorkoutSetMap): Map<Metric, Comparison> {
  let metricComparison = new Map<Metric, Comparison>();
  Object.values(Metric).forEach((metric) => {
    // Per-training callers pass no workoutsCount because a single-training
    // Frequency has no meaning. Skip FREQUENCY instead of letting the fail-fast
    // guard in calculateMetricValue throw and crash the React tree. (GH-119)
    if (metric === Metric.FREQUENCY && workout.currentWorkoutsCount === undefined) {
      return;
    }
    let current = calculateMetricValue(workout.currentWorkoutSets, metric, workout.currentWorkoutsCount)!!;
    const canComputeLast = metric !== Metric.FREQUENCY || workout.lastWorkoutsCount !== undefined;
    let last =
      (workout.lastWorkoutSets?.length ?? 0) > 0 && canComputeLast
        ? calculateMetricValue(workout.lastWorkoutSets ?? [], metric, workout.lastWorkoutsCount)
        : undefined;
    let difference = last ? current - last : undefined;
    metricComparison.set(metric, {value: current, difference: difference});
  });
  return metricComparison;
}

export function calculateMetricComparisonsForMuscle(workout: Map<Exercise, WorkoutSetMap>): Map<Muscles, Map<Metric, Comparison>> {
  let exerciseWorkoutMap: ExerciseWorkoutSetMap = {
    currentWorkoutSets: new Map<Exercise, WorkoutSet[]>(),
    lastWorkoutSets: new Map<Exercise, WorkoutSet[]>(),
    currentWorkoutsCounts: new Map<Exercise, number>(),
    lastWorkoutsCounts: new Map<Exercise, number>(),
  };
  Array.from(workout.entries()).forEach(([exercise, workoutSetMap]) => {
    exerciseWorkoutMap.currentWorkoutSets.set(exercise, workoutSetMap.currentWorkoutSets);
    exerciseWorkoutMap?.lastWorkoutSets?.set(exercise, workoutSetMap.lastWorkoutSets ?? []);
    exerciseWorkoutMap?.currentWorkoutsCounts?.set(exercise, workoutSetMap.currentWorkoutsCount ?? 0);
    exerciseWorkoutMap?.lastWorkoutsCounts?.set(exercise, workoutSetMap.lastWorkoutsCount ?? 0);
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
      let current = calculateMetricValueForMuscles(exerciseWorkoutMap.currentWorkoutSets, metric, muscle, exerciseWorkoutMap.currentWorkoutsCounts)!!;
      let last = (exerciseWorkoutMap.lastWorkoutSets?.size ?? 0) > 0 ? calculateMetricValueForMuscles(exerciseWorkoutMap.lastWorkoutSets ?? new Map(), metric, muscle, exerciseWorkoutMap.lastWorkoutsCounts) : undefined;
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
  currentWorkoutsCount?: number;
  lastWorkoutsCount?: number;
}

export interface ExerciseWorkoutSetMap {
  currentWorkoutSets: Map<Exercise, WorkoutSet[]>;
  lastWorkoutSets?: Map<Exercise, WorkoutSet[]>;
  currentWorkoutsCounts?: Map<Exercise, number>;
  lastWorkoutsCounts?: Map<Exercise, number>;
}
