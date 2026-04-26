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
 * Convert a Training's doneWorkoutIds to ExerciseSessions with raw set data.
 */
function trainingToSessions(
  training: Training,
  workoutsById: Record<number, Workout>,
  exercisesById: Record<number, Exercise>,
  vlLookup: Map<string, number>,
): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];

  for (const [exIdStr, workoutId] of Object.entries(training.doneWorkoutIds)) {
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

export function buildCoachPrompt(input: CoachInsightInput): {system: string; user: string} {
  const system =
    `You are an expert powerlifting coach reviewing an athlete's training log. ` +
    `Analyse the chronological sessions below and give at most two findings. ` +
    `Max 3 sentences. Be direct and specific. Prioritise the analysis of the data. ` +
    `Focus on the most impactful findings. Prioritise these signals if present:\n` +
    `- VL% vs RIR discrepancy: high velocity loss but high RIR reported (possible under-reporting of effort or form breakdown)\n` +
    `- Muscle-group frequency imbalance: one primary muscle group trained significantly less often than others\n` +
    `- Volume stagnation: no load or volume progression across consecutive sessions for the same exercise\n` +
    `- Sets where vl_percent > 25: typically indicates excessive fatigue accumulation`;


  // Render sessions as structured text (not JSON — shorter token count)
  const sessionLines: string[] = [];
  for (const session of input.sessions) {
    const label = session.is_current_training
      ? `=== CURRENT TRAINING (${session.date}) ===`
      : `--- Session ${session.date} ---`;
    sessionLines.push(label);
    for (const ex of session.exercises) {
      const muscleStr = ex.primary_muscles.length > 0
        ? ` [${ex.primary_muscles.join(', ')}]`
        : '';
      sessionLines.push(`  ${ex.name}${muscleStr}`);
      for (const s of ex.sets) {
        const vlStr = s.vl_percent != null ? `, VL%=${s.vl_percent}` : '';
        sessionLines.push(`    ${s.weight_kg}kg × ${s.reps} reps, RIR ${s.rir}${vlStr}`);
      }
    }
  }

  const user =
    `Training log (last 4 weeks, chronological):\n\n` +
    sessionLines.join('\n') +
    `\n\nCoach insight:`;

  return {system, user};
}
