import {BUILT_IN_MUSCLES, Muscles} from '../models/Muscles';
import {Metric} from '../models/Metric';
import {Exercise} from '../models/entities/Exercise';
import type {MuscleSettings} from '../redux/settings/settingsReducer';

/** GH-523: longest muscle name — keeps the editor and overview label columns readable. */
export const MAX_MUSCLE_NAME_LENGTH = 24;

const EMPTY: string[] = [];

/** Trims and collapses inner whitespace: `'  Rear   delts '` → `'Rear delts'`. */
export const normalizeMuscleName = (raw: string): string => (raw ?? '').trim().replace(/\s+/g, ' ');

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** Built-in muscles the user kept (canonical order), then the user's own muscles (in the order added). */
export const resolveAvailableMuscles = (settings: MuscleSettings | undefined): Muscles[] => {
  const removed = settings?.removed ?? EMPTY;
  return [...BUILT_IN_MUSCLES.filter((muscle) => !removed.includes(muscle)), ...(settings?.custom ?? EMPTY)];
};

/** The available muscles that the overviews show. */
export const resolveOverviewMuscles = (settings: MuscleSettings | undefined): Muscles[] => {
  const hidden = settings?.hiddenInOverviews ?? EMPTY;
  return resolveAvailableMuscles(settings).filter((muscle) => !hidden.includes(muscle));
};

export const sortMusclesByName = (muscles: Muscles[]): Muscles[] => [...muscles].sort((a, b) => a.localeCompare(b));

/**
 * Why `raw` can't be added as a new muscle, or `undefined` when it can. Numbers and
 * metric names are rejected because the Analyse picker mixes muscles with exercise
 * ids and metrics in one value list.
 */
export const validateMuscleName = (raw: string, available: Muscles[]): string | undefined => {
  const name = normalizeMuscleName(raw);
  if (name === '') return 'Enter a muscle name.';
  if (name.length > MAX_MUSCLE_NAME_LENGTH) return `Use at most ${MAX_MUSCLE_NAME_LENGTH} characters.`;
  if (/^\d+$/.test(name)) return 'A muscle name needs at least one letter.';
  const existing = available.find((muscle) => sameName(muscle, name));
  if (existing) return `${existing} already exists.`;
  if (Object.values(Metric).some((metric) => sameName(metric, name))) return `${name} is already used as a metric name.`;
  return undefined;
};

const withoutHidden = (settings: MuscleSettings | undefined, muscle: Muscles) => (settings?.hiddenInOverviews ?? EMPTY).filter((hidden) => !sameName(hidden, muscle));

/**
 * Adds a muscle. Re-adding a removed built-in muscle restores it under its built-in
 * name, so exercises imported or created later keep matching it. Invalid names leave
 * the settings untouched (same reference).
 */
export const addMuscle = (settings: MuscleSettings | undefined, raw: string): MuscleSettings | undefined => {
  const name = normalizeMuscleName(raw);
  if (validateMuscleName(name, resolveAvailableMuscles(settings)) !== undefined) return settings;
  const builtIn = BUILT_IN_MUSCLES.find((muscle) => sameName(muscle, name));
  if (builtIn) {
    return {...settings, removed: (settings?.removed ?? EMPTY).filter((muscle) => muscle !== builtIn), hiddenInOverviews: withoutHidden(settings, builtIn)};
  }
  return {...settings, custom: [...(settings?.custom ?? EMPTY), name], hiddenInOverviews: withoutHidden(settings, name)};
};

/** Removes a muscle from the list. Unknown muscles leave the settings untouched (same reference). */
export const removeMuscle = (settings: MuscleSettings | undefined, muscle: Muscles): MuscleSettings | undefined => {
  if (!resolveAvailableMuscles(settings).includes(muscle)) return settings;
  const hiddenInOverviews = withoutHidden(settings, muscle);
  if (BUILT_IN_MUSCLES.includes(muscle)) {
    return {...settings, removed: [...(settings?.removed ?? EMPTY), muscle], hiddenInOverviews};
  }
  return {...settings, custom: (settings?.custom ?? EMPTY).filter((custom) => custom !== muscle), hiddenInOverviews};
};

/** Shows or hides an available muscle in the overviews. No change → same reference. */
export const setMuscleInOverviews = (settings: MuscleSettings | undefined, muscle: Muscles, visible: boolean): MuscleSettings | undefined => {
  if (!resolveAvailableMuscles(settings).includes(muscle)) return settings;
  const hidden = settings?.hiddenInOverviews ?? EMPTY;
  if (hidden.includes(muscle) !== visible) return settings;
  return {...settings, hiddenInOverviews: visible ? hidden.filter((h) => h !== muscle) : [...hidden, muscle]};
};

/** How many exercises have a non-zero share of `muscle`. */
export const countExercisesUsingMuscle = (exercises: Exercise[], muscle: Muscles): number =>
  exercises.filter((exercise) => exercise?.muscles?.some((pair) => pair.muscle === muscle && (pair.percent ?? 0) > 0)).length;
