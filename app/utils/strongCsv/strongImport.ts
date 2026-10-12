import {GlobalState} from '../../redux/rootReducer';
import {Exercise, Record} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';
import {Training} from '../../models/entities/Training';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {TrainingsState} from '../../models/TrainingsState';
import {determineNewWorkoutId} from '../../redux/normalizedWorkoutState';
import {trainingInMicroIndex} from '../../redux/Training/trainingsPlanReducer';
import {DEFAULT_EXERCISES} from '../../redux/Exercises/exercisesReducer';
import {repetitionMax} from '../AnalyseUtils';
import {detectDelimiter, parseCsv} from './csv';
import {EXERCISE_LOG_WORKOUT_NAME, StrongCsvState} from './strongExport';
import {LB_TO_KG, parseStrongDate, parseStrongDuration, parseStrongNumber, rpeToRir} from './strongFormat';

export type WeightUnit = 'kg' | 'lb';

export const STRONG_IMPORT_PLAN_NAME = 'Strong Import';
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** More distinct workout names than this cannot be a weekly split → fall back to weekdays. */
export const MAX_NAMED_TRAININGS = 7;

export class StrongCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StrongCsvError';
  }
}

export interface ParsedStrongSet {
  /** As written in the file, in `ParsedStrongFile.weightUnit` (or the row's own unit). */
  weight: number;
  unit?: WeightUnit;
  reps: number;
  rpe?: number;
}

export interface ParsedStrongExercise {
  name: string;
  notes: string;
  sets: ParsedStrongSet[];
}

export interface ParsedStrongSession {
  start: number;
  durationSeconds?: number;
  name: string;
  notes: string;
  exercises: ParsedStrongExercise[];
}

export interface ParsedStrongFile {
  /** Unit of the weight column; undefined for old exports whose header has no unit. */
  weightUnit?: WeightUnit;
  sessions: ParsedStrongSession[];
  setCount: number;
  skippedCardioRows: number;
  /** Failed attempts (0 reps with a weight): they are no set and must not count toward 1RM/records. */
  skippedFailedSets: number;
  /** Rest timer, note and empty rows. */
  skippedOtherRows: number;
}

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const WEIGHT_COLUMNS: {[header: string]: WeightUnit | undefined} = {
  'weight (kg)': 'kg',
  kg: 'kg',
  'weight (lb)': 'lb',
  'weight (lbs)': 'lb',
  lbs: 'lb',
  lb: 'lb',
  weight: undefined,
};

/**
 * Reads a Strong CSV (Strong 6.x `;` format or the older `,` format). Throws a
 * `StrongCsvError` for anything that is not a Strong export, so nothing is imported.
 */
export function parseStrongCsv(text: string): ParsedStrongFile {
  const rows = parseCsv(text, detectDelimiter(text));
  if (rows.length === 0) throw new StrongCsvError('The file is empty.');

  const header = rows[0].map(normalizeHeader);
  const column = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const dateCol = column('date');
  const exerciseCol = column('exercise name');
  const repsCol = column('reps');
  const weightCol = header.findIndex((h) => h in WEIGHT_COLUMNS);
  const missing = [
    dateCol < 0 ? 'Date' : undefined,
    exerciseCol < 0 ? 'Exercise Name' : undefined,
    repsCol < 0 ? 'Reps' : undefined,
    weightCol < 0 ? 'Weight' : undefined,
  ].filter(Boolean);
  if (missing.length > 0) throw new StrongCsvError(`This is not a Strong CSV export (missing column: ${missing.join(', ')}).`);

  const workoutNumberCol = column('workout #');
  const nameCol = column('workout name');
  const durationCol = column('duration (sec)', 'duration');
  const setOrderCol = column('set order');
  const rpeCol = column('rpe');
  const distanceCol = header.findIndex((h) => h.startsWith('distance') || h === 'mi.' || h === 'km');
  const secondsCol = column('seconds');
  const notesCol = column('notes');
  const workoutNotesCol = column('workout notes');
  const unitCol = column('weight unit');
  const fileUnit = WEIGHT_COLUMNS[header[weightCol]];

  const sessions = new Map<string, ParsedStrongSession>();
  let setCount = 0;
  let skippedCardioRows = 0;
  let skippedFailedSets = 0;
  let skippedOtherRows = 0;
  // Strong leaves the weight empty only for reps-only (bodyweight) exercises, which never carry a
  // weight. An empty weight on an exercise that is weighted elsewhere in the file is a damaged row.
  const weightedExercises = new Set<string>();
  const emptyWeightLines = new Map<string, number>();

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const cell = (col: number) => (col >= 0 ? (row[col] ?? '').trim() : '');
    const setOrder = cell(setOrderCol).toLowerCase();
    if (setOrder === 'rest timer' || setOrder === 'note') {
      skippedOtherRows++;
      return;
    }
    const exerciseName = cell(exerciseCol).replace(/\s+/g, ' ');
    const dateText = cell(dateCol);
    const date = parseStrongDate(dateText);
    if (!date) throw new StrongCsvError(`Line ${line}: "${dateText}" is not a valid date.`);
    if (exerciseName === '') throw new StrongCsvError(`Line ${line}: the exercise name is missing.`);

    const repsText = cell(repsCol);
    const reps = parseStrongNumber(repsText);
    if (repsText !== '' && reps === undefined) throw new StrongCsvError(`Line ${line}: "${repsText}" is not a valid number of reps.`);
    const weightText = cell(weightCol);
    const weight = parseStrongNumber(weightText);
    if (weightText !== '' && weight === undefined) throw new StrongCsvError(`Line ${line}: "${weightText}" is not a valid weight.`);
    if ((weight ?? 0) > 0) weightedExercises.add(normalizeName(exerciseName));
    // A 0-rep set with a weight is a failed attempt: skipped, otherwise its weight would count as a 1RM.
    const hasReps = reps !== undefined && reps > 0;
    if (!hasReps && (weight ?? 0) > 0) {
      skippedFailedSets++;
      return;
    }
    if (!hasReps) {
      const distance = parseStrongNumber(cell(distanceCol)) ?? 0;
      const seconds = parseStrongNumber(cell(secondsCol)) ?? 0;
      if (distance > 0 || seconds > 0) skippedCardioRows++;
      else skippedOtherRows++;
      return;
    }

    if (weight === undefined && !emptyWeightLines.has(normalizeName(exerciseName))) emptyWeightLines.set(normalizeName(exerciseName), line);

    const name = cell(nameCol);
    const key = workoutNumberCol >= 0 && cell(workoutNumberCol) !== '' ? `#${cell(workoutNumberCol)}` : `${dateText}|${name}`;
    let session = sessions.get(key);
    if (!session) {
      session = {
        start: date.getTime(),
        durationSeconds: parseStrongDuration(cell(durationCol)),
        name,
        notes: cell(workoutNotesCol),
        exercises: [],
      };
      sessions.set(key, session);
    }
    let exercise = session.exercises.find((e) => normalizeName(e.name) === normalizeName(exerciseName));
    if (!exercise) {
      exercise = {name: exerciseName, notes: '', sets: []};
      session.exercises.push(exercise);
    }
    const note = cell(notesCol);
    if (note !== '' && exercise.notes === '') exercise.notes = note;
    const rowUnit = unitCol >= 0 ? WEIGHT_COLUMNS[normalizeHeader(cell(unitCol))] : undefined;
    exercise.sets.push({weight: weight ?? 0, unit: rowUnit, reps: reps ?? 0, rpe: parseStrongNumber(cell(rpeCol))});
    setCount++;
  });

  const damagedLine = Math.min(...Array.from(emptyWeightLines).filter(([exercise]) => weightedExercises.has(exercise)).map(([, line]) => line));
  if (Number.isFinite(damagedLine)) throw new StrongCsvError(`Line ${damagedLine}: the weight is missing.`);
  if (setCount === 0) throw new StrongCsvError('The file contains no strength sets to import.');
  return {
    weightUnit: fileUnit,
    sessions: Array.from(sessions.values()).sort((a, b) => a.start - b.start),
    setCount,
    skippedCardioRows,
    skippedFailedSets,
    skippedOtherRows,
  };
}

export interface StrongImportOptions {
  /** Unit for files whose weight column carries none (old Strong exports). Default kg. */
  assumedWeightUnit?: WeightUnit;
}

export interface StrongImportSummary {
  planName: string;
  /** Imported trainings (after same-day sessions were merged). */
  trainingCount: number;
  /** Sessions that were folded into another one of the same day. */
  mergedSessionCount: number;
  setCount: number;
  exerciseCount: number;
  newExerciseCount: number;
  weekCount: number;
  namedBy: 'names' | 'weekdays';
  trainingNames: string[];
  /** Sessions skipped because Gainalytics already has a training/workout at that time. */
  duplicateSessionCount: number;
  skippedCardioRows: number;
  skippedFailedSets: number;
  skippedOtherRows: number;
  weightUnit: WeightUnit;
  weightUnitFromFile: boolean;
}

export interface StrongImportResult<S extends StrongCsvState = GlobalState> {
  state: S;
  summary: StrongImportSummary;
}

/** Strong's automatic names ("Evening Workout") say nothing about the training. */
export function isDefaultWorkoutName(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized === '' ||
    normalized === normalizeName(EXERCISE_LOG_WORKOUT_NAME) ||
    /^((early |late )?(morning|afternoon|evening|night|midday|lunch|noon)|new|empty|quick)?\s*workout$/.test(normalized)
  );
}

const toTime = (value: Date | string | number | undefined): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
};

const dayNumber = (time: number) => {
  const date = new Date(time);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
};
/** 0 = Monday … 6 = Sunday */
const weekdayIndex = (time: number) => (new Date(time).getDay() + 6) % 7;
const mondayDayNumber = (time: number) => dayNumber(time) - weekdayIndex(time);

interface MergedSession {
  start: number;
  /** Starts of the later sessions folded into this one. */
  mergedStarts: number[];
  end: number;
  name: string;
  notes: string[];
  exercises: ParsedStrongExercise[];
  merged: number;
}

function mergeSameDaySessions(sessions: ParsedStrongSession[]): MergedSession[] {
  const byDay = new Map<number, MergedSession>();
  [...sessions]
    .sort((a, b) => a.start - b.start)
    .forEach((session) => {
      const end = session.start + (session.durationSeconds ?? 0) * 1000;
      const day = dayNumber(session.start);
      const existing = byDay.get(day);
      if (!existing) {
        byDay.set(day, {
          start: session.start,
          end,
          name: session.name.trim(),
          notes: session.notes ? [session.notes] : [],
          exercises: session.exercises.map((e) => ({...e, sets: [...e.sets]})),
          mergedStarts: [],
          merged: 0,
        });
        return;
      }
      existing.merged++;
      existing.mergedStarts.push(session.start);
      existing.end = Math.max(existing.end, end);
      if (session.notes && !existing.notes.includes(session.notes)) existing.notes.push(session.notes);
      session.exercises.forEach((exercise) => {
        const same = existing.exercises.find((e) => normalizeName(e.name) === normalizeName(exercise.name));
        if (same) same.sets.push(...exercise.sets);
        else existing.exercises.push({...exercise, sets: [...exercise.sets]});
      });
    });
  return Array.from(byDay.values()).sort((a, b) => a.start - b.start);
}

/**
 * Turns a parsed Strong file into one new plan ("Strong Import"): one micro per
 * calendar week (Monday start), one FINISHED training per day. Training slots use
 * the workout names when they describe a split (≤ 7 names, none of them Strong's
 * automatic "Evening Workout" kind), otherwise the weekdays. Pure: the same input always yields the same state,
 * so the summary shown before importing matches what the reducer applies.
 */
export function buildStrongImport<S extends StrongCsvState>(state: S, parsed: ParsedStrongFile, options: StrongImportOptions = {}): StrongImportResult<S> {
  const weightUnit: WeightUnit = parsed.weightUnit ?? options.assumedWeightUnit ?? 'kg';

  // 1. Skip sessions that already exist (same start second) — no double import.
  const existingStarts = new Set<number>();
  state.trainings.allIds.forEach((id) => {
    const training = state.trainings.byId[id];
    const start = toTime(training?.start);
    if (start !== undefined) existingStarts.add(Math.floor(start / 1000));
    training?.mergedSessionStarts?.forEach((merged) => existingStarts.add(Math.floor(merged / 1000)));
  });
  state.workouts.allIds.forEach((id) => {
    const start = toTime(state.workouts.byId[id]?.start);
    if (start !== undefined) existingStarts.add(Math.floor(start / 1000));
  });
  const fresh = parsed.sessions.filter((session) => !existingStarts.has(Math.floor(session.start / 1000)));
  const duplicateSessionCount = parsed.sessions.length - fresh.length;

  // 2. Two sessions on the same day become one training.
  const sessions = mergeSameDaySessions(fresh);

  // 3. Name the training slots.
  const firstMonday = sessions.length > 0 ? mondayDayNumber(sessions[0].start) : 0;
  const weekOf = (time: number) => Math.floor((mondayDayNumber(time) - firstMonday) / 7) + 1;
  const distinctNames: string[] = [];
  sessions.forEach((s) => {
    if (!distinctNames.some((n) => normalizeName(n) === normalizeName(s.name))) distinctNames.push(s.name);
  });
  const useNames = distinctNames.length > 0 && distinctNames.length <= MAX_NAMED_TRAININGS && !distinctNames.some(isDefaultWorkoutName);
  const nameIndex = (session: MergedSession) => distinctNames.findIndex((n) => normalizeName(n) === normalizeName(session.name));

  // A name trained twice in one week (A/B/A splits) gets a second slot with the same name.
  const occurrence = new Map<MergedSession, number>();
  const perWeek = new Map<string, number>();
  const maxOccurrence = distinctNames.map(() => 1);
  sessions.forEach((session) => {
    const key = `${weekOf(session.start)}|${nameIndex(session)}`;
    const n = (perWeek.get(key) ?? 0) + 1;
    perWeek.set(key, n);
    occurrence.set(session, n);
    maxOccurrence[nameIndex(session)] = Math.max(maxOccurrence[nameIndex(session)], n);
  });
  // Slots: every name once in order of first appearance, then the second occurrences, …
  const nameSlots: {name: number; occurrence: number}[] = [];
  for (let n = 1; n <= Math.max(1, ...maxOccurrence); n++) {
    distinctNames.forEach((_, i) => {
      if (maxOccurrence[i] >= n) nameSlots.push({name: i, occurrence: n});
    });
  }

  const usedWeekdays = Array.from(new Set(sessions.map((s) => weekdayIndex(s.start)))).sort((a, b) => a - b);
  const slotOf = (session: MergedSession): number => {
    if (useNames) return nameSlots.findIndex((slot) => slot.name === nameIndex(session) && slot.occurrence === occurrence.get(session)) + 1;
    return usedWeekdays.indexOf(weekdayIndex(session.start)) + 1;
  };
  const trainingNames: {[slot: string]: string} = {};
  if (useNames) nameSlots.forEach((slot, i) => (trainingNames[i + 1] = distinctNames[slot.name]));
  else usedWeekdays.forEach((weekday, i) => (trainingNames[i + 1] = WEEKDAY_NAMES[weekday]));

  // 4. Exercises: reuse same-named ones, create the rest once.
  const exercisesById = {...state.exercises.byId};
  const exerciseAllIds = [...state.exercises.allIds];
  const exerciseIdByName = new Map<string, number>();
  exerciseAllIds.forEach((id) => {
    const name = exercisesById[id]?.name;
    if (name !== undefined && !exerciseIdByName.has(normalizeName(name))) exerciseIdByName.set(normalizeName(name), id);
  });
  let nextExerciseId = Math.max(0, ...exerciseAllIds) + 1;
  const touchedExerciseIds = new Set<number>();
  let newExerciseCount = 0;
  const exerciseIdFor = (name: string): number => {
    const key = normalizeName(name);
    const known = exerciseIdByName.get(key);
    if (known !== undefined) return known;
    const id = nextExerciseId++;
    const defaults = DEFAULT_EXERCISES.find((e) => normalizeName(e.name) === key);
    exercisesById[id] = {id, name: name.trim(), isFocus: false, muscles: defaults?.muscles ?? []} as Exercise;
    exerciseAllIds.push(id);
    exerciseIdByName.set(key, id);
    newExerciseCount++;
    return id;
  };

  // 5. Trainings + logged workouts.
  const workoutsById = {...state.workouts.byId};
  const trainingsById = {...state.trainings.byId};
  const trainingAllIds = [...state.trainings.allIds];
  let nextWorkoutId = determineNewWorkoutId(state.workouts);
  let nextTrainingId =
    Math.max(
      0,
      ...trainingAllIds,
      ...Object.keys(state.trainings.byId)
        .map(Number)
        .filter((id) => Number.isFinite(id)),
    ) + 1;
  const planTrainings: {[key: string]: number} = {};
  const newWorkoutIds: number[] = [];
  let setCount = 0;
  const toKg = (set: ParsedStrongSet) => {
    const kg = (set.unit ?? weightUnit) === 'lb' ? set.weight * LB_TO_KG : set.weight;
    return Math.round(kg * 100) / 100;
  };

  sessions.forEach((session) => {
    const trainingId = nextTrainingId++;
    const startIso = new Date(session.start).toISOString();
    const endIso = new Date(session.end).toISOString();
    const doneWorkoutIds: {[exerciseId: number]: number} = {};
    const exerciseIds: number[] = [];
    session.exercises.forEach((exercise) => {
      const exerciseId = exerciseIdFor(exercise.name);
      touchedExerciseIds.add(exerciseId);
      // A file listing the same exercise twice under different spellings maps to one workout.
      const existingWorkoutId = doneWorkoutIds[exerciseId];
      const sets = exercise.sets.map((set) => ({
        weight: toKg(set),
        reps: set.reps,
        // Decimal RPEs (9.5) keep their half rep, so a re-export writes the same RPE again.
        rir: set.rpe !== undefined ? Math.min(10, Math.max(0, Math.round(rpeToRir(set.rpe) * 100) / 100)) : 0,
        date: startIso as unknown as Date,
      }));
      setCount += sets.length;
      if (existingWorkoutId !== undefined) {
        const workout = workoutsById[existingWorkoutId];
        workout.sets = [...workout.sets, ...sets].map((set, i) => ({...set, index: i + 1}));
        return;
      }
      const workoutId = nextWorkoutId++;
      workoutsById[workoutId] = {
        id: workoutId,
        exerciseId,
        trainingsId: trainingId,
        start: startIso as unknown as Date,
        end: endIso as unknown as Date,
        sets: sets.map((set, i) => ({...set, index: i + 1})),
        ...(exercise.notes ? {notes: exercise.notes} : {}),
      } as Workout;
      doneWorkoutIds[exerciseId] = workoutId;
      exerciseIds.push(exerciseId);
      newWorkoutIds.push(workoutId);
    });
    const training: Training = {
      id: trainingId,
      state: TrainingsState.FINISHED,
      start: session.start as unknown as Date,
      end: session.end as unknown as Date,
      exercises: exerciseIds,
      plannedWorkouts: {},
      doneWorkoutIds,
      ...(session.notes.length > 0 ? {notes: session.notes.join('\n')} : {}),
      ...(session.mergedStarts.length > 0 ? {mergedSessionStarts: session.mergedStarts} : {}),
    };
    trainingsById[trainingId] = training;
    trainingAllIds.push(trainingId);
    planTrainings[trainingInMicroIndex(weekOf(session.start), slotOf(session))] = trainingId;
  });

  // 6. Insert the logged workouts in end order, like the workout reducer does.
  const endTime = (id: number) => toTime(workoutsById[id]?.end) ?? toTime(workoutsById[id]?.start) ?? 0;
  const insertByEnd = (ids: number[], additions: number[]) => {
    const result = [...ids];
    additions.forEach((id) => {
      const end = endTime(id);
      const later = result.findIndex((existing) => workoutsById[existing]?.end !== undefined && endTime(existing) > end);
      if (later >= 0) result.splice(later, 0, id);
      else result.push(id);
    });
    return result;
  };
  const workoutAllIds = insertByEnd(state.workouts.allIds, newWorkoutIds);
  const byExerciseId = {...state.workouts.byExerciseId};
  touchedExerciseIds.forEach((exerciseId) => {
    byExerciseId[exerciseId] = insertByEnd(
      byExerciseId[exerciseId] ?? [],
      newWorkoutIds.filter((id) => workoutsById[id].exerciseId === exerciseId),
    );
  });

  // 7. 1RM record history (Records/analysis read it), rebuilt in start order for every touched
  //    exercise: imported history can predate, beat or devalue the records the app already had.
  touchedExerciseIds.forEach((exerciseId) => {
    const exercise = exercisesById[exerciseId];
    const records: {value: number; workoutId: number}[] = [];
    let best = 0;
    byExerciseId[exerciseId]
      .map((id) => ({id, start: toTime(workoutsById[id]?.start)}))
      .filter((entry): entry is {id: number; start: number} => entry.start !== undefined)
      .sort((a, b) => a.start - b.start)
      .forEach(({id: workoutId}) => {
        const workout = workoutsById[workoutId];
        const oneRm = repetitionMax(...workout.sets);
        if (oneRm - best > 0.01) {
          best = oneRm;
          records.push({value: oneRm.toFixed(2) as unknown as number, workoutId});
          workoutsById[workoutId] = {...workout, records: {...workout.records, [Record.ONE_RM]: parseFloat(oneRm.toFixed(2))}};
        } else if (workout.records?.[Record.ONE_RM] !== undefined) {
          const {[Record.ONE_RM]: _, ...otherRecords} = workout.records;
          workoutsById[workoutId] = {...workout, records: otherRecords};
        }
      });
    exercisesById[exerciseId] = {...exercise, records: {...exercise.records, [Record.ONE_RM]: records}};
  });

  // 8. The plan.
  const existingPlanNames = new Set(state.trainingsPlan.allIds.map((id) => state.trainingsPlan.byId[id]?.name));
  let planName = STRONG_IMPORT_PLAN_NAME;
  for (let n = 2; existingPlanNames.has(planName); n++) planName = `${STRONG_IMPORT_PLAN_NAME} ${n}`;
  const planId = Math.max(0, ...state.trainingsPlan.allIds) + 1;
  const plan: TrainingsPlan = {
    id: planId,
    name: planName,
    trainings: planTrainings,
    trainingNames,
    lastTraining: trainingAllIds[trainingAllIds.length - 1],
    mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
  };

  const summary: StrongImportSummary = {
    planName,
    trainingCount: sessions.length,
    mergedSessionCount: sessions.reduce((sum, s) => sum + s.merged, 0),
    setCount,
    exerciseCount: touchedExerciseIds.size,
    newExerciseCount,
    weekCount: sessions.length > 0 ? weekOf(sessions[sessions.length - 1].start) : 0,
    namedBy: useNames ? 'names' : 'weekdays',
    trainingNames: useNames ? distinctNames : Object.values(trainingNames),
    duplicateSessionCount,
    skippedCardioRows: parsed.skippedCardioRows,
    skippedFailedSets: parsed.skippedFailedSets,
    skippedOtherRows: parsed.skippedOtherRows,
    weightUnit,
    weightUnitFromFile: parsed.weightUnit !== undefined,
  };

  if (sessions.length === 0) return {state, summary};

  return {
    summary,
    state: {
      ...state,
      exercises: {...state.exercises, byId: exercisesById, allIds: exerciseAllIds},
      workouts: {...state.workouts, byId: workoutsById, allIds: workoutAllIds, byExerciseId},
      trainings: {...state.trainings, byId: trainingsById, allIds: trainingAllIds},
      trainingsPlan: {
        ...state.trainingsPlan,
        byId: {...state.trainingsPlan.byId, [planId]: plan},
        allIds: [...state.trainingsPlan.allIds, planId],
      },
    },
  };
}
