import {Training} from '../../models/entities/Training';
import {Workout} from '../../models/entities/Workout';
import {WorkoutSet} from '../../models/entities/WorkoutSet';
import {Exercise} from '../../models/entities/Exercise';
import {VideoAnalysis, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {TrainingsState} from '../../models/TrainingsState';
import {Meso, TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {
  formatPlanNumber,
  getPlanRangeMax,
  PlanRangeField,
} from '../planRange';
import {
  getLocalMicro,
  getMesoForMicro,
  getMicroFromTrainingInMicroIndex,
  getTrainingFromTrainingInMicroIndex,
} from '../../redux/Training/trainingsPlanReducer';

/**
 * GH-391 — the planning half of the AI chat context.
 *
 * Everything the chat knew before this file existed came from FINISHED trainings
 * (see serializeTrainingsForChat). This module adds what is *planned* and, on
 * demand, one single training the user wants to talk about.
 *
 * Two rules govern the shape:
 *
 *  1. A planned range (GH-63) reaches the model AS A RANGE. `8-12` is never
 *     collapsed to `8` — that is exactly the information a planning question
 *     needs. Fixed values keep their plain numeric form, so a plan without any
 *     range serialises just like the finished-training half.
 *  2. The context stays bounded: only the CURRENT and the NEXT micro of the
 *     active plan are included, never the whole meso or macro plan.
 */

/** `8` for a fixed value, `"8-12"` for a planned range. */
export type PlannedValue = number | string;

export interface PlannedSet {
  reps: PlannedValue;
  weight_kg: PlannedValue;
  rir: PlannedValue;
}

export interface PerformedSet {
  reps: number;
  weight_kg: number;
  rir: number;
  vl_percent?: number;
}

export interface PlannedExercise {
  name: string;
  sets: PlannedSet[];
}

export interface PerformedExercise {
  name: string;
  sets: PerformedSet[];
}

export interface PlannedSession {
  /** Global micro number inside the plan. */
  micro: number;
  /** 1-based micro number inside its meso. */
  micro_in_meso: number;
  meso_name?: string;
  /** Position of the session inside the micro (the plan's "training number"). */
  position: number;
  name: string;
  state: 'planned' | 'started';
  /** Only set when the session already has a start time (a running session). */
  date?: string;
  exercises: PlannedExercise[];
}

export interface PlannedTrainingsContext {
  plan_name: string;
  /** Which micros are covered — the bound that keeps this context small. */
  scope: string;
  current_micro: number;
  sessions: PlannedSession[];
}

export interface SelectedTrainingContext {
  training_id: number;
  name: string;
  plan_name?: string;
  meso_name?: string;
  micro?: number;
  micro_in_meso?: number;
  position?: number;
  state: 'planned' | 'started' | 'finished';
  date?: string;
  planned: PlannedExercise[];
  /** Absent while nothing has been logged yet — never an empty placeholder. */
  performed?: PerformedExercise[];
}

/** Where a training sits in its plan. Built once per plan set, reused everywhere. */
export interface TrainingLocator {
  planId: number;
  planName: string;
  micro: number;
  microInMeso: number;
  mesoName?: string;
  position: number;
  name: string;
}

export interface SelectableTraining {
  id: number;
  /** Human label for the picker row, e.g. `Micro 7 · Push squat`. */
  label: string;
  state: 'planned' | 'started' | 'finished';
  /** ISO date (yyyy-mm-dd) for finished sessions, undefined for planned ones. */
  date?: string;
}

const STATE_LABEL: Record<TrainingsState, 'planned' | 'started' | 'finished'> = {
  [TrainingsState.PLANNED]: 'planned',
  [TrainingsState.STARTED]: 'started',
  [TrainingsState.FINISHED]: 'finished',
};

const isoDay = (value: Date | string | undefined): string | undefined =>
  value ? new Date(value).toISOString().substring(0, 10) : undefined;

const trainingName = (plan: TrainingsPlan, position: number): string =>
  plan.trainingNames?.[String(position)] ?? `Training ${position}`;

/**
 * The planned value of one field. A range keeps both bounds (`"8-12"`), a fixed
 * value stays the number it already was.
 */
export function plannedFieldValue(workoutSet: WorkoutSet, field: PlanRangeField): PlannedValue {
  const max = getPlanRangeMax(workoutSet, field);
  if (max === undefined) return workoutSet[field];
  return `${formatPlanNumber(workoutSet[field])}-${formatPlanNumber(max)}`;
}

const toPlannedSet = (workoutSet: WorkoutSet): PlannedSet => ({
  reps: plannedFieldValue(workoutSet, 'reps'),
  weight_kg: plannedFieldValue(workoutSet, 'weight'),
  rir: plannedFieldValue(workoutSet, 'rir'),
});

/** Velocity-loss lookup keyed by `${workoutId}_${setIndex}`, same rule as the finished half. */
function buildVlLookup(videoAnalysesById: Record<number, VideoAnalysis>): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const analysis of Object.values(videoAnalysesById ?? {})) {
    if (
      analysis?.status === VideoAnalysisStatus.DONE &&
      analysis.workoutId != null &&
      analysis.setIndex != null &&
      analysis.setResult?.velocityLossPercent != null
    ) {
      lookup.set(`${analysis.workoutId}_${analysis.setIndex}`, Math.round(analysis.setResult.velocityLossPercent));
    }
  }
  return lookup;
}

/**
 * Turn a training's workout map into exercise entries. Exercises without a
 * workout or without a single set are dropped — an empty shell would read to the
 * model like a session that is planned but has nothing in it.
 */
function collectExercises<T>(
  workoutIds: {[exerciseId: number]: number} | undefined,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  mapSets: (sets: WorkoutSet[], workoutId: number) => T[],
): {name: string; sets: T[]}[] {
  const result: {name: string; sets: T[]}[] = [];
  for (const [exerciseIdStr, workoutId] of Object.entries(workoutIds ?? {})) {
    const workout = workoutsById?.[workoutId];
    if (!workout?.sets?.length) continue;
    const exerciseId = parseInt(exerciseIdStr, 10);
    const name = exercisesById?.[exerciseId]?.name ?? `Exercise ${exerciseId}`;
    result.push({name, sets: mapSets(workout.sets as WorkoutSet[], workoutId)});
  }
  return result;
}

const plannedExercisesOf = (
  training: Training,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
): PlannedExercise[] =>
  collectExercises(training.plannedWorkouts, workoutsById, exercisesById, sets => sets.map(toPlannedSet));

const performedExercisesOf = (
  training: Training,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  vlLookup: Map<string, number>,
): PerformedExercise[] =>
  collectExercises(training.doneWorkoutIds, workoutsById, exercisesById, (sets, workoutId) =>
    sets.map((s, idx) => {
      const set: PerformedSet = {reps: s.reps, weight_kg: s.weight, rir: s.rir};
      const vl = vlLookup.get(`${workoutId}_${s.index ?? idx}`);
      if (vl != null) set.vl_percent = vl;
      return set;
    }),
  );

interface Slot {
  key: string;
  micro: number;
  position: number;
  trainingId: number;
  training: Training | undefined;
}

function sortedSlots(plan: TrainingsPlan, trainingsById: Record<number, Training>): Slot[] {
  return Object.entries(plan.trainings ?? {})
    .map(([key, trainingId]) => ({
      key,
      micro: getMicroFromTrainingInMicroIndex(key),
      position: getTrainingFromTrainingInMicroIndex(key),
      trainingId: trainingId as number,
      training: trainingsById?.[trainingId as number],
    }))
    .sort((a, b) => (a.micro !== b.micro ? a.micro - b.micro : a.position - b.position));
}

/**
 * The plan the user is currently training in — the same rule the training home
 * uses: a plan with a running session wins, otherwise the plan whose last
 * finished training is the most recent one.
 */
export function selectActivePlan(
  plans: TrainingsPlan[],
  trainingsById: Record<number, Training>,
): TrainingsPlan | undefined {
  const withStarted = plans.find(plan =>
    Object.values(plan.trainings ?? {}).some(id => trainingsById?.[id as number]?.state === TrainingsState.STARTED),
  );
  if (withStarted) return withStarted;

  let best: TrainingsPlan | undefined;
  let bestTime = -Infinity;
  for (const plan of plans) {
    for (const id of Object.values(plan.trainings ?? {})) {
      const training = trainingsById?.[id as number];
      if (training?.state !== TrainingsState.FINISHED || !training.end) continue;
      const time = new Date(training.end).getTime();
      if (time > bestTime) {
        bestTime = time;
        best = plan;
      }
    }
  }
  // A plan that has never been trained is still a plan the chat should know
  // about — otherwise the very first micro a user plans stays invisible.
  return best ?? plans.find(plan => Object.keys(plan.trainings ?? {}).length > 0);
}

/**
 * The micro the athlete is in right now: the one holding a running session, or
 * the earliest micro that still has an unfinished slot after the last finished
 * one. Falls back to the last finished micro when the plan is fully trained.
 */
export function currentMicroOf(plan: TrainingsPlan, trainingsById: Record<number, Training>): number | undefined {
  const slots = sortedSlots(plan, trainingsById);
  if (slots.length === 0) return undefined;

  const running = slots.find(s => s.training?.state === TrainingsState.STARTED);
  if (running) return running.micro;

  let lastFinished: Slot | undefined;
  for (const slot of slots) {
    if (slot.training?.state === TrainingsState.FINISHED) lastFinished = slot;
  }

  const nextOpen = slots.find(slot => {
    if (slot.training?.state === TrainingsState.FINISHED) return false;
    if (!lastFinished) return true;
    return slot.micro > lastFinished.micro || (slot.micro === lastFinished.micro && slot.position > lastFinished.position);
  });
  if (nextOpen) return nextOpen.micro;

  return lastFinished?.micro;
}

/**
 * The planned sessions of the current and the next micro of the active plan.
 *
 * Returns `null` when there is nothing planned — no plans, no active plan, or
 * every session in scope already trained. `null` keeps the caller from putting
 * an empty planning block into the prompt.
 */
export function buildPlannedTrainingsContext(
  plans: TrainingsPlan[],
  trainingsById: Record<number, Training>,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
): PlannedTrainingsContext | null {
  const plan = selectActivePlan(plans ?? [], trainingsById);
  if (!plan) return null;

  const currentMicro = currentMicroOf(plan, trainingsById);
  if (currentMicro === undefined) return null;

  const mesos: Meso[] | undefined = plan.mesos;
  const sessions: PlannedSession[] = [];

  for (const slot of sortedSlots(plan, trainingsById)) {
    // The bound: current micro and the one after it. Nothing else.
    if (slot.micro !== currentMicro && slot.micro !== currentMicro + 1) continue;
    const training = slot.training;
    if (!training || training.state === TrainingsState.FINISHED) continue;

    const exercises = plannedExercisesOf(training, workoutsById, exercisesById);
    if (exercises.length === 0) continue;

    // Placement first, exercises last — the model (and anyone reading the
    // context preview) should see WHERE a session sits before its contents.
    const session: PlannedSession = {
      micro: slot.micro,
      micro_in_meso: getLocalMicro(mesos, slot.micro),
      meso_name: getMesoForMicro(mesos, slot.micro)?.name,
      position: slot.position,
      name: trainingName(plan, slot.position),
      state: training.state === TrainingsState.STARTED ? 'started' : 'planned',
      date: isoDay(training.start),
      exercises,
    };
    if (session.meso_name === undefined) delete session.meso_name;
    if (session.date === undefined) delete session.date;
    sessions.push(session);
  }

  if (sessions.length === 0) return null;

  return {
    plan_name: plan.name,
    scope: `current micro ${currentMicro} and next micro ${currentMicro + 1}`,
    current_micro: currentMicro,
    sessions,
  };
}

/** Index every training that sits in a plan, so a picked id can be placed in the plan. */
export function buildTrainingLocators(
  plans: TrainingsPlan[],
  trainingsById: Record<number, Training>,
): Map<number, TrainingLocator> {
  const locators = new Map<number, TrainingLocator>();
  for (const plan of plans ?? []) {
    for (const slot of sortedSlots(plan, trainingsById)) {
      locators.set(slot.trainingId, {
        planId: plan.id ?? -1,
        planName: plan.name,
        micro: slot.micro,
        microInMeso: getLocalMicro(plan.mesos, slot.micro),
        mesoName: getMesoForMicro(plan.mesos, slot.micro)?.name,
        position: slot.position,
        name: trainingName(plan, slot.position),
      });
    }
  }
  return locators;
}

/**
 * The full picture of ONE training: what was planned for it and, once it has
 * been trained, what actually happened — so the model can compare target and
 * reality. Returns `null` for an id that has neither.
 */
export function buildSelectedTrainingContext(
  trainingId: number,
  trainingsById: Record<number, Training>,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  videoAnalysesById: Record<number, VideoAnalysis>,
  locators: Map<number, TrainingLocator>,
): SelectedTrainingContext | null {
  const training = trainingsById?.[trainingId];
  if (!training) return null;

  const locator = locators.get(trainingId);
  const planned = plannedExercisesOf(training, workoutsById, exercisesById);
  const performed = performedExercisesOf(training, workoutsById, exercisesById, buildVlLookup(videoAnalysesById));
  if (planned.length === 0 && performed.length === 0) return null;

  const context: SelectedTrainingContext = {
    training_id: trainingId,
    name: locator?.name ?? `Training ${trainingId}`,
    state: STATE_LABEL[training.state] ?? 'planned',
    planned,
  };
  if (locator) {
    context.plan_name = locator.planName;
    context.micro = locator.micro;
    context.micro_in_meso = locator.microInMeso;
    context.position = locator.position;
    if (locator.mesoName) context.meso_name = locator.mesoName;
  }
  const date = isoDay(training.end ?? training.start);
  if (date) context.date = date;
  if (performed.length > 0) context.performed = performed;

  return context;
}

/**
 * The trainings offered in the "talk about one training" picker: everything
 * planned in the current/next micro first, then the most recent finished
 * sessions. Bounded by `finishedLimit` so the list stays scrollable.
 */
export function listChatSelectableTrainings(
  plans: TrainingsPlan[],
  trainingsById: Record<number, Training>,
  finishedLimit = 15,
): SelectableTraining[] {
  const locators = buildTrainingLocators(plans ?? [], trainingsById);
  const activePlan = selectActivePlan(plans ?? [], trainingsById);
  const currentMicro = activePlan ? currentMicroOf(activePlan, trainingsById) : undefined;

  const describe = (id: number, training: Training): SelectableTraining => {
    const locator = locators.get(id);
    const label = locator ? `Micro ${locator.micro} · ${locator.name}` : `Training ${id}`;
    return {
      id,
      label,
      state: STATE_LABEL[training.state] ?? 'planned',
      date: isoDay(training.end),
    };
  };

  const planned: SelectableTraining[] = [];
  if (activePlan && currentMicro !== undefined) {
    for (const slot of sortedSlots(activePlan, trainingsById)) {
      if (slot.micro !== currentMicro && slot.micro !== currentMicro + 1) continue;
      if (!slot.training || slot.training.state === TrainingsState.FINISHED) continue;
      // An empty slot is a placeholder, not a session anyone can talk about.
      if (Object.keys(slot.training.plannedWorkouts ?? {}).length === 0) continue;
      planned.push(describe(slot.trainingId, slot.training));
    }
  }

  const finished = Object.entries(trainingsById ?? {})
    .map(([idStr, training]) => ({id: parseInt(idStr, 10), training}))
    .filter(({training}) => training?.state === TrainingsState.FINISHED && training.end)
    .sort((a, b) => new Date(b.training.end!).getTime() - new Date(a.training.end!).getTime())
    .slice(0, finishedLimit)
    .map(({id, training}) => describe(id, training));

  return [...planned, ...finished];
}
