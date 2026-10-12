import {MusclePercentPair} from './entities/Exercise';

/**
 * GH-497: a built-in program template. It is plain data; `buildTemplatePlanPayload`
 * turns it into a normal plan (mesos → micros → trainings with planned sets).
 */
export interface ProgramTemplate {
  id: string;
  name: string;
  /** One line for the picker. */
  summary: string;
  description: string;
  /** Names of the trainings in a micro, in order (plan-wide, like `trainingNames`). */
  dayNames: string[];
  mesos: TemplateMeso[];
}

export interface TemplateMeso {
  name: string;
  /** One entry per micro of this meso. */
  micros: TemplateMicroStep[];
  /** One exercise list per entry of `dayNames`. */
  days: TemplateExercise[][];
}

/**
 * How a micro differs from the base prescription: `rirDelta` is added to every
 * exercise's base RIR (clamped at 0). A deload halves the sets and adds 2 RIR.
 */
export interface TemplateMicroStep {
  rirDelta: number;
  deload?: boolean;
}

export interface TemplateExercise {
  exercise: string;
  sets: number;
  reps: number;
  /** Upper bound of a rep range (GH-63), e.g. 8–10. */
  repsMax?: number;
  /** RIR in the first micro of the meso. */
  rir: number;
}

/** Muscle mapping for a template exercise that is not one of the default exercises. */
export interface TemplateExerciseDefinition {
  name: string;
  muscles: MusclePercentPair[];
}
