import {Exercise} from '../models/entities/Exercise';
import {Training} from '../models/entities/Training';
import {Meso} from '../models/entities/TrainingsPlan';
import {Workout} from '../models/entities/Workout';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {TrainingsState} from '../models/TrainingsState';
import {ProgramTemplate, TemplateExercise, TemplateMicroStep} from '../models/ProgramTemplate';
import {TEMPLATE_EXTRA_EXERCISES} from '../constants/programTemplates';
import {DEFAULT_EXERCISES} from '../redux/Exercises/exercisesReducer';
import {trainingInMicroIndex} from '../redux/Training/trainingsPlanReducer';
import {TrainingsPlanExportPayload} from './exportTrainingsPlan';
import {repetitionWeightByOneRm} from './AnalyseUtils';

/** Exercises are matched by name, ignoring case and stray whitespace ("Squat " = "squat"). */
export const normalizeExerciseName = (name: string | undefined): string => (name ?? '').trim().toLowerCase();

export interface TemplateBuildContext {
  /** The user's current exercises — same-named ones are reused instead of created. */
  existingExercises: Exercise[];
  /** All-time 1RM of an existing exercise, 0 when unknown. Drives the suggested weights. */
  oneRepMaxFor: (exerciseId: number) => number;
  /** Defaults to the template name. */
  planName?: string;
}

export interface TemplateStructure {
  mesos: number;
  micros: number;
  trainingsPerMicro: number;
  trainings: number;
  exercises: string[];
}

const WEIGHT_STEP_KG = 2.5;

export function templateStructure(template: ProgramTemplate): TemplateStructure {
  const micros = template.mesos.reduce((sum, meso) => sum + meso.micros.length, 0);
  const exercises = Array.from(new Set(template.mesos.flatMap((meso) => meso.days.flat().map((e) => e.exercise))));
  return {
    mesos: template.mesos.length,
    micros,
    trainingsPerMicro: template.dayNames.length,
    trainings: micros * template.dayNames.length,
    exercises,
  };
}

/** "2 mesos · 8 micros · 3 trainings per micro" */
export function formatTemplateStructure(template: ProgramTemplate): string {
  const {mesos, micros, trainingsPerMicro} = templateStructure(template);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(mesos, 'meso')} · ${plural(micros, 'micro')} · ${plural(trainingsPerMicro, 'training')} per micro`;
}

/** Suggested working weight for reps @ RIR from a 1RM, rounded down to the next 2.5 kg; 0 (empty) without a 1RM. */
export function suggestedWeight(oneRepMax: number, reps: number, rir: number): number {
  if (!(oneRepMax > 0)) return 0;
  const weight = repetitionWeightByOneRm(reps, rir, oneRepMax);
  return Math.max(0, Math.floor(weight / WEIGHT_STEP_KG) * WEIGHT_STEP_KG);
}

export function plannedSetsFor(prescription: TemplateExercise, step: TemplateMicroStep, oneRepMax: number): WorkoutSet[] {
  const sets = step.deload ? Math.max(1, Math.ceil(prescription.sets / 2)) : prescription.sets;
  const rir = step.deload ? prescription.rir + 2 : Math.max(0, prescription.rir + step.rirDelta);
  const weight = suggestedWeight(oneRepMax, prescription.reps, rir);
  return Array.from({length: sets}, (_, i) => ({
    index: i + 1,
    reps: prescription.reps,
    ...(prescription.repsMax !== undefined ? {repsMax: prescription.repsMax} : {}),
    rir,
    weight,
  }));
}

function templateExerciseDefinition(name: string): Exercise {
  const known = [...DEFAULT_EXERCISES, ...TEMPLATE_EXTRA_EXERCISES].find((e) => normalizeExerciseName(e.name) === normalizeExerciseName(name));
  return {name, muscles: known?.muscles ?? []};
}

/**
 * Turns a template into the same payload a shared plan file carries, so it is
 * created through `IMPORT_TRAININGS_PLAN` like any imported plan: exercises are
 * matched by name, everything else gets fresh ids. Ids inside the payload are local.
 */
export function buildTemplatePlanPayload(template: ProgramTemplate, context: TemplateBuildContext): TrainingsPlanExportPayload {
  const existingByName = new Map(context.existingExercises.map((e) => [normalizeExerciseName(e.name), e]));

  const exercises: Exercise[] = [];
  const localIdByName = new Map<string, number>();
  const oneRepMaxByLocalId = new Map<number, number>();
  const localExerciseId = (name: string): number => {
    const key = normalizeExerciseName(name);
    const known = localIdByName.get(key);
    if (known !== undefined) return known;
    const id = exercises.length + 1;
    const existing = existingByName.get(key);
    exercises.push(existing ? {id, name: existing.name, muscles: existing.muscles} : {...templateExerciseDefinition(name), id});
    localIdByName.set(key, id);
    oneRepMaxByLocalId.set(id, existing?.id !== undefined ? context.oneRepMaxFor(existing.id) : 0);
    return id;
  };

  const workouts: Workout[] = [];
  const trainings: Training[] = [];
  const planTrainings: {[slot: string]: number} = {};
  const mesos: Meso[] = [];

  let globalMicro = 0;
  template.mesos.forEach((meso, mesoIndex) => {
    mesos.push({id: mesoIndex + 1, name: meso.name, order: mesoIndex + 1, startMicro: globalMicro + 1});
    meso.micros.forEach((step) => {
      globalMicro++;
      meso.days.forEach((day, dayIndex) => {
        const trainingId = trainings.length + 1;
        const plannedWorkouts: {[exerciseId: number]: number} = {};
        const exerciseIds = day.map((prescription) => {
          const exerciseId = localExerciseId(prescription.exercise);
          const workoutId = workouts.length + 1;
          workouts.push({
            id: workoutId,
            exerciseId,
            sets: plannedSetsFor(prescription, step, oneRepMaxByLocalId.get(exerciseId) ?? 0),
          });
          plannedWorkouts[exerciseId] = workoutId;
          return exerciseId;
        });
        trainings.push({
          id: trainingId,
          exercises: exerciseIds,
          plannedWorkouts,
          doneWorkoutIds: {},
          state: TrainingsState.PLANNED,
        });
        planTrainings[trainingInMicroIndex(globalMicro, dayIndex + 1)] = trainingId;
      });
    });
  });

  return {
    trainingsPlan: {
      name: context.planName?.trim() || template.name,
      description: template.description,
      trainings: planTrainings,
      trainingNames: Object.fromEntries(template.dayNames.map((dayName, i) => [String(i + 1), dayName])),
      mesos,
    },
    trainings,
    exercises,
    workouts,
  };
}
