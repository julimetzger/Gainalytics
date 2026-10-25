/**
 * The built-in muscles every install starts with.
 *
 * GH-523: users can add their own muscles and remove built-in ones, so a muscle is
 * identified by its display name and the `Muscles` type is a plain string. The
 * effective list lives in `settings.muscles` — read it through `useAvailableMuscles`
 * / `useOverviewMuscles`, not from this object.
 */
export const Muscles = {
  BACK: 'Back',
  BICEPS: 'Biceps',
  CHEST: 'Chest',
  CORE: 'Core',
  GLUTES: 'Glutes',
  HAMSTRINGS: 'Hamstrings',
  QUADS: 'Quads',
  SHOULDERS: 'Shoulders',
  TRICEPS: 'Triceps',
};

export type Muscles = string;

/** Built-in muscles in their canonical order (also the radar's axis order). */
export const BUILT_IN_MUSCLES: Muscles[] = Object.values(Muscles);
