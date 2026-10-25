/**
 * GH-528 (from the GH-502 PoC): maps a finished Gainalytics training onto a Health Connect
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
import {HealthConnectSegmentKey} from '../../models/HealthConnectSegmentType';

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
export const segmentTypeForName = (name: string | undefined): HealthConnectSegmentKey => {
  const normalized = (name ?? '').toLowerCase();
  const rule = SEGMENT_RULES.find(([pattern]) => pattern.test(normalized));
  return rule ? rule[1] : 'WEIGHTLIFTING';
};

/** The user's choice in the exercise editor wins over the name rule. */
export const segmentTypeForExercise = (exercise: Pick<Exercise, 'name' | 'healthConnectType'> | undefined): HealthConnectSegmentKey =>
  exercise?.healthConnectType ?? segmentTypeForName(exercise?.name);

/**
 * Health Connect record id of a training. Training ids restart after a backup restore or a reinstall,
 * so new data gets a namespace (see healthConnectReducer `recordNamespace`): otherwise a new training
 * could reuse the id of an older one and overwrite its Health Connect session. Without a namespace the
 * original format is kept, so entries written before namespaces existed can still be updated/deleted.
 */
export const clientRecordIdForTraining = (trainingId: number, namespace?: string) => (namespace ? `gainalytics-${namespace}-training-${trainingId}` : `gainalytics-training-${trainingId}`);

const MIN_SEGMENT_MS = 1000;

const toMs = (value: Date | string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
};

const formatSet = (set: WorkoutSet): string => `${set.reps} × ${set.weight} kg @ RIR ${set.rir}`;

/** "3 × (5 × 100 kg @ RIR 2), 1 × (3 × 105 kg @ RIR 1)" — consecutive identical sets are grouped. */
export const describeSets = (sets: WorkoutSet[]): string => {
  const groups: Array<{text: string; count: number}> = [];
  sets.forEach((set) => {
    const text = formatSet(set);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.count += 1;
    else groups.push({text, count: 1});
  });
  return groups.map((g) => (g.count > 1 ? `${g.count} × (${g.text})` : g.text)).join(', ');
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
  namespace?: string,
): HealthConnectSessionInput | null => {
  const startMs = toMs(training.start);
  const endMs = toMs(training.end);
  if (training.id === undefined || training.state !== TrainingsState.FINISHED || startMs === undefined || endMs === undefined || endMs <= startMs) {
    return null;
  }

  const done = (training.exercises ?? [])
    .map((exerciseId) => {
      const workoutId = training.doneWorkoutIds?.[exerciseId];
      const workout = workoutId !== undefined ? workoutsById[workoutId] : undefined;
      const sets = (workout?.sets ?? []).filter((set) => set.reps > 0);
      const exercise = exercisesById[exerciseId];
      return {workout, sets, exercise, name: exercise?.name ?? `Exercise ${exerciseId}`};
    })
    .filter((entry) => entry.workout && entry.sets.length > 0);
  if (done.length === 0) return null;

  // Segments must not overlap and must stay inside the session. Use the workout's own time span
  // where it fits after the previous segment; otherwise split the remaining time evenly. Every
  // exercise keeps at least MIN_SEGMENT_MS, so overlapping or out-of-order workouts (supersets)
  // are squeezed instead of silently dropped.
  let cursor = startMs;
  const segments: HealthConnectSegmentInput[] = [];
  done.forEach((entry, index) => {
    const remaining = done.length - index;
    const latestEnd = endMs - (remaining - 1) * MIN_SEGMENT_MS;
    const ownStart = toMs(entry.workout?.start);
    const ownEnd = toMs(entry.workout?.end);
    const ownSpan = ownStart !== undefined && ownEnd !== undefined && ownEnd > ownStart && ownEnd > cursor ? {start: ownStart, end: ownEnd} : undefined;
    const segStart = Math.min(ownSpan ? Math.max(cursor, ownSpan.start) : cursor, latestEnd - MIN_SEGMENT_MS);
    const wantedEnd = ownSpan ? ownSpan.end : cursor + (endMs - cursor) / remaining;
    const segEnd = Math.min(Math.max(wantedEnd, segStart + MIN_SEGMENT_MS), latestEnd);
    if (segEnd <= segStart) return;
    segments.push({
      startMs: Math.round(segStart),
      endMs: Math.round(segEnd),
      segmentType: segmentTypeForExercise(entry.exercise),
      repetitions: entry.sets.reduce((sum, set) => sum + set.reps, 0),
      exerciseName: entry.name,
    });
    cursor = segEnd;
  });

  const names = done.map((entry) => entry.name);
  const title = `Gainalytics: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`;
  const protocol = done.map((entry) => `${entry.name}: ${describeSets(entry.sets)}`).join('\n');
  const trainingNotes = training.notes?.toString().trim();

  return {
    clientRecordId: clientRecordIdForTraining(training.id, namespace),
    clientRecordVersion: now,
    title,
    notes: trainingNotes ? `${trainingNotes}\n\n${protocol}` : protocol,
    startMs,
    endMs,
    segments,
  };
};

/**
 * Identifies the written content of a session: equal fingerprints mean Health Connect already
 * holds exactly this training, so nothing has to be rewritten. The version is excluded on purpose.
 */
export const healthConnectFingerprint = ({clientRecordVersion: _version, ...content}: HealthConnectSessionInput): string => JSON.stringify(content);
