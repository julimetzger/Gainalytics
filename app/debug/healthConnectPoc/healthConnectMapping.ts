/**
 * GH-502 proof of concept: maps a finished Gainalytics training onto a Health Connect
 * ExerciseSessionRecord (exercise type STRENGTH_TRAINING).
 *
 * Health Connect knows sessions and segments. A segment has a type (e.g. BENCH_PRESS),
 * a time span and a repetition count, but no weight, no RIR and no per-set structure.
 * One segment per exercise therefore carries the summed reps; the per-set details
 * (reps × weight @ RIR) only survive as plain text in the session notes.
 */
import {Exercise} from '../../models/entities/Exercise';
import {Training} from '../../models/entities/Training';
import {Workout} from '../../models/entities/Workout';
import {WorkoutSet} from '../../models/entities/WorkoutSet';
import {TrainingsState} from '../../models/TrainingsState';

/** Segment keys understood by the native PoC module (HealthConnectPocModule.segmentTypeOf). */
export type HealthConnectSegmentKey =
  | 'SQUAT'
  | 'BENCH_PRESS'
  | 'DEADLIFT'
  | 'BARBELL_SHOULDER_PRESS'
  | 'SHOULDER_PRESS'
  | 'LAT_PULL_DOWN'
  | 'PULL_UP'
  | 'DUMBBELL_ROW'
  | 'LEG_PRESS'
  | 'LEG_CURL'
  | 'LEG_EXTENSION'
  | 'LUNGE'
  | 'HIP_THRUST'
  | 'ARM_CURL'
  | 'LATERAL_RAISE'
  | 'BACK_EXTENSION'
  | 'CRUNCH'
  | 'PLANK'
  | 'LEG_RAISE'
  | 'KETTLEBELL_SWING'
  | 'WEIGHTLIFTING';

export interface HealthConnectSegmentInput {
  startMs: number;
  endMs: number;
  segmentType: HealthConnectSegmentKey;
  repetitions: number;
  /** Only for display/debugging; not written to Health Connect. */
  exerciseName: string;
}

export interface HealthConnectSessionInput {
  clientRecordId: string;
  clientRecordVersion: number;
  title: string;
  notes: string;
  startMs: number;
  endMs: number;
  segments: HealthConnectSegmentInput[];
}

// Order matters: more specific patterns first ("leg press" before "press", "split squat" before "squat").
const SEGMENT_RULES: Array<[RegExp, HealthConnectSegmentKey]> = [
  [/leg press/, 'LEG_PRESS'],
  [/leg curl|hamstring curl/, 'LEG_CURL'],
  [/leg extension/, 'LEG_EXTENSION'],
  [/leg raise/, 'LEG_RAISE'],
  [/split squat|lunge/, 'LUNGE'],
  [/squat/, 'SQUAT'],
  [/deadlift|\brdl\b/, 'DEADLIFT'],
  [/bench/, 'BENCH_PRESS'],
  [/overhead press|military press|\bohp\b/, 'BARBELL_SHOULDER_PRESS'],
  [/shoulder press/, 'SHOULDER_PRESS'],
  [/pull ?down|lat pull/, 'LAT_PULL_DOWN'],
  [/pull[- ]?up|chin[- ]?up/, 'PULL_UP'],
  [/dumbbell row/, 'DUMBBELL_ROW'],
  [/hip thrust/, 'HIP_THRUST'],
  [/lateral raise/, 'LATERAL_RAISE'],
  [/back extension|hyperextension/, 'BACK_EXTENSION'],
  [/curl/, 'ARM_CURL'],
  [/crunch/, 'CRUNCH'],
  [/plank/, 'PLANK'],
  [/kettlebell swing/, 'KETTLEBELL_SWING'],
];

/** Best-effort guess of the Health Connect segment type from a free-text exercise name. */
export const segmentTypeForExercise = (name: string | undefined): HealthConnectSegmentKey => {
  const normalized = (name ?? '').toLowerCase();
  const rule = SEGMENT_RULES.find(([pattern]) => pattern.test(normalized));
  return rule ? rule[1] : 'WEIGHTLIFTING';
};

const toMs = (value: Date | string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const ms = new Date(value as any).getTime();
  return Number.isFinite(ms) ? ms : undefined;
};

const formatSet = (set: WorkoutSet): string => `${set.reps} × ${set.weight} kg @ RIR ${set.rir}`;

/** "3 × (5 × 100 kg @ RIR 2), 1 × (3 × 105 kg @ RIR 1)" — consecutive identical sets are grouped. */
export const describeSets = (sets: WorkoutSet[]): string => {
  const groups: Array<{text: string; count: number}> = [];
  sets.forEach(set => {
    const text = formatSet(set);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.count += 1;
    else groups.push({text, count: 1});
  });
  return groups.map(g => (g.count > 1 ? `${g.count} × (${g.text})` : g.text)).join(', ');
};

/**
 * Builds the Health Connect payload for one training, or returns null if the training is
 * not finished, has no valid time span or contains no executed set.
 */
export const mapTrainingToHealthConnectSession = (
  training: Training,
  workoutsById: {[id: number]: Workout},
  exercisesById: {[id: number]: Exercise},
  now: number = Date.now(),
): HealthConnectSessionInput | null => {
  const startMs = toMs(training.start);
  const endMs = toMs(training.end);
  if (training.state !== TrainingsState.FINISHED || startMs === undefined || endMs === undefined || endMs <= startMs) {
    return null;
  }

  const done = (training.exercises ?? [])
    .map(exerciseId => {
      const workoutId = training.doneWorkoutIds?.[exerciseId];
      const workout = workoutId !== undefined ? workoutsById[workoutId] : undefined;
      const sets = (workout?.sets ?? []).filter(set => set.reps > 0);
      return {exerciseId, workout, sets, name: exercisesById[exerciseId]?.name ?? `Exercise ${exerciseId}`};
    })
    .filter(entry => entry.workout && entry.sets.length > 0);
  if (done.length === 0) return null;

  // Use the workout's own time span when it lies inside the training; otherwise split the
  // training evenly. Segments must not overlap and must stay inside the session.
  const slot = (endMs - startMs) / done.length;
  let cursor = startMs;
  const segments: HealthConnectSegmentInput[] = [];
  done.forEach((entry, index) => {
    const ownStart = toMs(entry.workout?.start);
    const ownEnd = toMs(entry.workout?.end);
    const hasOwnSpan =
      ownStart !== undefined && ownEnd !== undefined && ownStart >= startMs && ownEnd <= endMs && ownEnd > ownStart;
    const segStart = Math.max(cursor, hasOwnSpan ? ownStart! : startMs + index * slot);
    const segEnd = Math.min(endMs, hasOwnSpan ? ownEnd! : startMs + (index + 1) * slot);
    if (segEnd <= segStart) return;
    segments.push({
      startMs: Math.round(segStart),
      endMs: Math.round(segEnd),
      segmentType: segmentTypeForExercise(entry.name),
      repetitions: entry.sets.reduce((sum, set) => sum + set.reps, 0),
      exerciseName: entry.name,
    });
    cursor = segEnd;
  });

  const names = done.map(entry => entry.name);
  const title = `Gainalytics: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`;
  const notes = done.map(entry => `${entry.name}: ${describeSets(entry.sets)}`).join('\n');

  return {
    clientRecordId: `gainalytics-training-${training.id}`,
    clientRecordVersion: now,
    title,
    notes,
    startMs,
    endMs,
    segments,
  };
};
