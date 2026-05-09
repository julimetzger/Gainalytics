import {Muscles} from '../../../models/Muscles';

export type MuscleGroupKey = 'All' | 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';

export const MUSCLE_GROUPS: MuscleGroupKey[] = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

const GROUP_TO_MUSCLES: Record<Exclude<MuscleGroupKey, 'All'>, Muscles[]> = {
  Chest: [Muscles.CHEST],
  Back: [Muscles.BACK],
  Legs: [Muscles.QUADS, Muscles.HAMSTRINGS, Muscles.GLUTES],
  Shoulders: [Muscles.SHOULDERS],
  Arms: [Muscles.BICEPS, Muscles.TRICEPS],
  Core: [Muscles.CORE],
};

export function exerciseMatchesGroup(exerciseMuscles: Muscles[], group: MuscleGroupKey): boolean {
  if (group === 'All') return true;
  const groupMuscles = GROUP_TO_MUSCLES[group];
  return exerciseMuscles.some((m) => groupMuscles.includes(m));
}

export function primaryMuscleTag(exerciseMuscles: Muscles[]): MuscleGroupKey | undefined {
  for (const group of (['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'] as Exclude<MuscleGroupKey, 'All'>[])) {
    if (exerciseMatchesGroup(exerciseMuscles, group)) return group;
  }
  return undefined;
}
