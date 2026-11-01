/**
 * Prepares training data for the AI Coach and builds the prompt.
 * Sends the raw Redux training structure (chronological sessions with per-set data).
 * No own aggregation — the LLM receives the data and identifies patterns itself.
 */
import {Training} from '../models/entities/Training';
import {Workout} from '../models/entities/Workout';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {Exercise} from '../models/entities/Exercise';
import {VideoAnalysis, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {TrainingsState} from '../models/TrainingsState';

// ─────────────────────────────────────────────────────────────────────────────
// Data types sent to the LLM (clean, no internal Redux ids)
// ─────────────────────────────────────────────────────────────────────────────

export interface SetData {
  reps: number;
  weight_kg: number;
  rir: number;
  /** Velocity loss percent from video analysis, if available for this set */
  vl_percent?: number;
  /** GH-645: upper bounds of a planned rep / load / RIR range (planned sets only) */
  reps_max?: number;
  weight_max_kg?: number;
  rir_max?: number;
}

export interface ExerciseSession {
  name: string;
  /** Primary muscles (highest % first, max 2) */
  primary_muscles: string[];
  sets: SetData[];
}

export interface TrainingSession {
  date: string; // ISO date string, e.g. "2026-04-08"
  /** True for the most recently completed training (the one just finished) */
  is_current_training: boolean;
  exercises: ExerciseSession[];
}

export interface CoachInsightInput {
  sessions: TrainingSession[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Data builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a VL% lookup keyed by `${workoutId}_${setIndex}` from video analyses.
 */
function buildVlLookup(
  videoAnalysesById: Record<number, VideoAnalysis>,
): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const analysis of Object.values(videoAnalysesById)) {
    if (
      analysis.status === VideoAnalysisStatus.DONE &&
      analysis.workoutId != null &&
      analysis.setIndex != null &&
      analysis.setResult?.velocityLossPercent != null
    ) {
      lookup.set(
        `${analysis.workoutId}_${analysis.setIndex}`,
        Math.round(analysis.setResult.velocityLossPercent),
      );
    }
  }
  return lookup;
}

/**
 * Build the primary muscles label for an exercise (top 1-2 muscle groups by %).
 */
function primaryMuscles(exercise: Exercise | undefined): string[] {
  if (!exercise?.muscles || exercise.muscles.length === 0) return [];
  const sorted = [...exercise.muscles]
    .filter(m => m.muscle != null)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 2);
  return sorted.map(m => m.muscle as string);
}

/**
 * Convert a Training's doneWorkoutIds (GH-645: or its plannedWorkouts) to ExerciseSessions with raw set data.
 */
function trainingToSessions(
  training: Training,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  vlLookup: Map<string, number>,
  side: 'done' | 'plan' = 'done',
): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];
  const workoutIds = (side === 'plan' ? training.plannedWorkouts : training.doneWorkoutIds) ?? {};

  for (const [exIdStr, workoutId] of Object.entries(workoutIds)) {
    const exerciseId = parseInt(exIdStr, 10);
    const workout = workoutsById[workoutId];
    if (!workout || !workout.sets || workout.sets.length === 0) continue;

    const exercise = exercisesById[exerciseId];
    const name = exercise?.name ?? `Exercise ${exerciseId}`;
    const muscles = primaryMuscles(exercise);

    const sets: SetData[] = (workout.sets as WorkoutSet[]).map((s, idx) => {
      const key = `${workoutId}_${s.index ?? idx}`;
      const vlPct = vlLookup.get(key);
      const setData: SetData = {
        reps: s.reps,
        weight_kg: s.weight,
        rir: s.rir,
      };
      if (vlPct != null) setData.vl_percent = vlPct;
      if (s.repsMax != null) setData.reps_max = s.repsMax;
      if (s.weightMax != null) setData.weight_max_kg = s.weightMax;
      if (s.rirMax != null) setData.rir_max = s.rirMax;
      return setData;
    });

    sessions.push({name, primary_muscles: muscles, sets});
  }

  return sessions;
}

/**
 * Build raw training data from the last 4 weeks of finished trainings.
 *
 * @param recentTrainings    FINISHED trainings from the last ~28 days, any order
 * @param currentTrainingId  id of the training just completed (marked is_current_training)
 * @param workoutsById       Redux workouts lookup
 * @param exercisesById      Redux exercises lookup (full Exercise objects)
 * @param videoAnalysesById  Redux video analyses lookup
 */
export function buildRawTrainingData(
  recentTrainings: Training[],
  currentTrainingId: number | undefined,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  videoAnalysesById: Record<number, VideoAnalysis>,
): CoachInsightInput {
  const finished = recentTrainings.filter(t => t.state === TrainingsState.FINISHED);

  // Sort chronologically (oldest → newest)
  const sorted = [...finished].sort((a, b) => {
    const ta = a.end ? new Date(a.end).getTime() : 0;
    const tb = b.end ? new Date(b.end).getTime() : 0;
    return ta - tb;
  });

  const vlLookup = buildVlLookup(videoAnalysesById);

  const sessions: TrainingSession[] = sorted.map(training => {
    const endDate = training.end
      ? new Date(training.end).toISOString().substring(0, 10)
      : 'unknown';
    const isCurrent = training.id != null && training.id === currentTrainingId;
    const exercises = trainingToSessions(training, workoutsById, exercisesById, vlLookup);
    return {
      date: endDate,
      is_current_training: isCurrent,
      exercises,
    };
  });

  return {sessions};
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

import {DEFAULT_SESSION_PROMPT, DEFAULT_TRAINING_PROMPT} from '../constants/aiPrompts';

const range = (low: number, high: number | undefined) => (high != null && high !== low ? `${low}–${high}` : `${low}`);

/** Render exercises as structured text (not JSON — shorter token count). */
function renderExercises(lines: string[], exercises: ExerciseSession[]): void {
  for (const ex of exercises) {
    const muscleStr = ex.primary_muscles.length > 0
      ? ` [${ex.primary_muscles.join(', ')}]`
      : '';
    lines.push(`  ${ex.name}${muscleStr}`);
    for (const s of ex.sets) {
      const vlStr = s.vl_percent != null ? `, VL%=${s.vl_percent}` : '';
      lines.push(`    ${range(s.weight_kg, s.weight_max_kg)}kg × ${range(s.reps, s.reps_max)} reps, RIR ${range(s.rir, s.rir_max)}${vlStr}`);
    }
  }
}

export function buildCoachPrompt(input: CoachInsightInput, systemOverride?: string): {system: string; user: string} {
  const system = systemOverride ?? DEFAULT_TRAINING_PROMPT;

  const sessionLines: string[] = [];
  for (const session of input.sessions) {
    const label = session.is_current_training
      ? `=== CURRENT TRAINING (${session.date}) ===`
      : `--- Session ${session.date} ---`;
    sessionLines.push(label);
    renderExercises(sessionLines, session.exercises);
  }

  const user =
    `Training log (last 4 weeks, chronological):\n\n` +
    sessionLines.join('\n') +
    `\n\nCoach insight:`;

  return {system, user};
}

// ─────────────────────────────────────────────────────────────────────────────
// GH-645: one training — its plan, what was done, and the last training at its position
// ─────────────────────────────────────────────────────────────────────────────

export interface SingleSessionInput {
  /** e.g. "Micro 2 · Push squat" */
  name: string;
  date: string;
  finished: boolean;
  plan: ExerciseSession[];
  done: ExerciseSession[];
  /** The last training at the same position that was trained ("vs last"), if any. */
  previous?: {name: string; date: string; done: ExerciseSession[]};
}

const isoDate = (training: Training) => {
  const at = training.end ?? training.start;
  return at ? new Date(at).toISOString().substring(0, 10) : 'unknown';
};

/**
 * Only this training (plan + done) and its comparison training (done) — no other session
 * reaches the prompt. Undefined when nothing was logged in this training yet.
 */
export function buildSingleSessionData(
  training: Training,
  name: string,
  previous: {training: Training; name: string} | undefined,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  videoAnalysesById: Record<number, VideoAnalysis>,
): SingleSessionInput | undefined {
  const vlLookup = buildVlLookup(videoAnalysesById);
  const done = trainingToSessions(training, workoutsById, exercisesById, vlLookup);
  if (done.length === 0) return undefined;
  const input: SingleSessionInput = {
    name,
    date: isoDate(training),
    finished: training.state === TrainingsState.FINISHED,
    plan: trainingToSessions(training, workoutsById, exercisesById, vlLookup, 'plan'),
    done,
  };
  if (previous) {
    const previousDone = trainingToSessions(previous.training, workoutsById, exercisesById, vlLookup);
    if (previousDone.length > 0) {
      input.previous = {name: previous.name, date: isoDate(previous.training), done: previousDone};
    }
  }
  return input;
}

export function buildSingleSessionPrompt(input: SingleSessionInput, systemOverride?: string): {system: string; user: string} {
  const system = systemOverride ?? DEFAULT_SESSION_PROMPT;
  const lines: string[] = [`Training: ${input.name} (${input.finished ? 'finished' : 'in progress'}, ${input.date})`, ''];

  lines.push('=== PLAN OF THIS TRAINING ===');
  if (input.plan.length > 0) {
    renderExercises(lines, input.plan);
  } else {
    lines.push('  (nothing planned)');
  }
  lines.push(`=== DONE IN THIS TRAINING (${input.date}) ===`);
  renderExercises(lines, input.done);
  if (input.previous) {
    lines.push(`--- LAST TIME: ${input.previous.name} (${input.previous.date}), done ---`);
    renderExercises(lines, input.previous.done);
  } else {
    lines.push('--- LAST TIME: no earlier training at this position ---');
  }

  return {system, user: lines.join('\n') + '\n\nCoach insight for this session:'};
}
