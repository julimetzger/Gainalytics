import {GlobalState} from '../../redux/rootReducer';
import {Workout} from '../../models/entities/Workout';
import {WorkoutSet} from '../../models/entities/WorkoutSet';
import {getTrainingFromTrainingInMicroIndex} from '../../redux/Training/trainingsPlanReducer';
import {serializeCsv} from './csv';
import {formatStrongDate, formatStrongNumber, formatStrongWeight, rirToRpe, STRONG_EXPORT_DELIMITER, STRONG_EXPORT_HEADER} from './strongFormat';

/** The slices the Strong CSV export/import read and write — read in components through `useStrongCsvState`. */
export type StrongCsvState = Pick<GlobalState, 'exercises' | 'workouts' | 'trainings' | 'trainingsPlan'>;

/** Workout Name for sets logged outside a training (from the exercise screen). */
export const EXERCISE_LOG_WORKOUT_NAME = 'Exercise log';

export interface StrongExport {
  csv: string;
  /** One row per logged set. */
  setCount: number;
  /** Number of distinct workouts (`Workout #`). */
  workoutCount: number;
}

interface ExportSession {
  start: number;
  end: number;
  name: string;
  notes: string;
  workouts: Workout[];
}

const toTime = (value: Date | string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
};

const localDayKey = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/** A logged workout that has at least one set — exactly the sets the export writes. */
const isExportable = (workout: Workout | undefined): workout is Workout =>
  workout !== undefined && toTime(workout.start) !== undefined && (workout.sets?.length ?? 0) > 0;

/** Number of logged sets the export would write (0 → nothing to export). */
export function countLoggedSets(state: StrongCsvState): number {
  return state.workouts.allIds.map((id) => state.workouts.byId[id]).filter(isExportable).reduce((sum, workout) => sum + workout.sets.length, 0);
}

function trainingNamesById(state: StrongCsvState): Map<number, string> {
  const names = new Map<number, string>();
  state.trainingsPlan.allIds.forEach((planId) => {
    const plan = state.trainingsPlan.byId[planId];
    Object.entries(plan?.trainings ?? {}).forEach(([key, trainingId]) => {
      const slot = getTrainingFromTrainingInMicroIndex(key);
      names.set(trainingId, (plan.trainingNames?.[slot] ?? `Training ${slot}`).trim());
    });
  });
  return names;
}

/**
 * Builds a Strong 6.x CSV of every logged set: one row per set, the training's name
 * as Workout Name, RPE = 10 − RIR, weights in kg.
 */
export function buildStrongExport(state: StrongCsvState): StrongExport {
  const trainingByWorkoutId = new Map<number, number>();
  state.trainings.allIds.forEach((trainingId) => {
    Object.values(state.trainings.byId[trainingId]?.doneWorkoutIds ?? {}).forEach((workoutId) => trainingByWorkoutId.set(workoutId, trainingId));
  });
  const names = trainingNamesById(state);

  const sessions = new Map<string, ExportSession>();
  state.workouts.allIds.forEach((workoutId) => {
    const workout = state.workouts.byId[workoutId];
    if (!isExportable(workout)) return;
    const workoutStart = toTime(workout.start)!;
    const workoutEnd = toTime(workout.end) ?? workoutStart;
    const trainingId = trainingByWorkoutId.get(workoutId) ?? workout.trainingsId;
    const training = trainingId !== undefined ? state.trainings.byId[trainingId] : undefined;
    const key = training ? `training-${trainingId}` : `day-${localDayKey(workoutStart)}`;

    let session = sessions.get(key);
    if (!session) {
      session = {
        start: toTime(training?.start) ?? workoutStart,
        end: toTime(training?.end) ?? workoutEnd,
        name: training ? names.get(trainingId!) ?? 'Workout' : EXERCISE_LOG_WORKOUT_NAME,
        notes: training?.notes ? String(training.notes) : '',
        workouts: [],
      };
      sessions.set(key, session);
    }
    if (!training || toTime(training.start) === undefined) session.start = Math.min(session.start, workoutStart);
    if (!training || toTime(training.end) === undefined) session.end = Math.max(session.end, workoutEnd);
    session.workouts.push(workout);
  });

  const ordered = Array.from(sessions.values()).sort((a, b) => a.start - b.start);
  const rows: (string | number)[][] = [STRONG_EXPORT_HEADER];
  let setCount = 0;

  ordered.forEach((session, sessionIndex) => {
    const date = formatStrongDate(new Date(session.start));
    const duration = String(Math.max(0, Math.round((session.end - session.start) / 1000)));
    const workouts = [...session.workouts].sort((a, b) => toTime(a.start)! - toTime(b.start)! || (a.id ?? 0) - (b.id ?? 0));
    workouts.forEach((workout) => {
      const exerciseName = (state.exercises.byId[workout.exerciseId]?.name ?? `Exercise ${workout.exerciseId}`).trim();
      const sets = [...workout.sets].sort((a: WorkoutSet, b: WorkoutSet) => (a.index ?? Infinity) - (b.index ?? Infinity));
      sets.forEach((set, setIndex) => {
        const weight = Number(set.weight);
        const reps = Number(set.reps);
        const rir = Number(set.rir);
        const hasRir = set.rir !== undefined && set.rir !== null && Number.isFinite(rir) && rir >= 0 && rir <= 10;
        rows.push([
          sessionIndex + 1,
          date,
          session.name,
          duration,
          exerciseName,
          setIndex + 1,
          Number.isFinite(weight) ? formatStrongWeight(weight) : '',
          Number.isFinite(reps) ? formatStrongNumber(reps) : '',
          hasRir ? formatStrongNumber(rirToRpe(rir)) : '',
          '',
          '',
          setIndex === 0 && workout.notes ? String(workout.notes) : '',
          session.notes,
        ]);
        setCount++;
      });
    });
  });

  return {csv: serializeCsv(rows, STRONG_EXPORT_DELIMITER), setCount, workoutCount: ordered.length};
}

/** `gainalytics_strong_2026-10-12.csv` */
export function strongExportFileName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `gainalytics_strong_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}
