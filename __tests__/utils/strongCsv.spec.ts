import fs from 'fs';
import path from 'path';
import rootReducer, {GlobalState} from '../../app/redux/rootReducer';
import {parseCsv, serializeCsv, detectDelimiter} from '../../app/utils/strongCsv/csv';
import {buildStrongExport, countLoggedSets, EXERCISE_LOG_WORKOUT_NAME} from '../../app/utils/strongCsv/strongExport';
import {buildStrongImport, isDefaultWorkoutName, parseStrongCsv, StrongCsvError, STRONG_IMPORT_PLAN_NAME} from '../../app/utils/strongCsv/strongImport';
import {formatStrongDate, parseStrongDuration, STRONG_EXPORT_HEADER} from '../../app/utils/strongCsv/strongFormat';
import {getMicroFromTrainingInMicroIndex, getTrainingFromTrainingInMicroIndex} from '../../app/redux/Training/trainingsPlanReducer';
import {TrainingsState} from '../../app/models/TrainingsState';

const freshState = (): GlobalState => rootReducer(undefined as any, {type: '@@INIT'}) as GlobalState;
const baselineState = (): GlobalState =>
  rootReducer(freshState() as any, {
    type: 'FULL_IMPORT',
    state: JSON.parse(fs.readFileSync(path.join(__dirname, '../e2e/maestro/fixtures/baseline.gains'), 'utf8')),
  } as any) as GlobalState;
const importStrong = (state: GlobalState, csv: string, options = {}) => rootReducer(state as any, {type: 'STRONG_IMPORT', parsed: parseStrongCsv(csv), options} as any) as GlobalState;

const STRONG6_HEADER = '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"';
const strong6Row = (n: number, date: string, name: string, exercise: string, order: string, weight: string, reps: string, rpe = '', distance = '', seconds = '') =>
  [n, date, name, 3600, exercise, order, weight, reps, rpe, distance, seconds, '', ''].map((v) => `"${v}"`).join(';');
const strong6 = (...rows: string[]) => [STRONG6_HEADER, ...rows].join('\n') + '\n';

const planOf = (state: GlobalState, name = STRONG_IMPORT_PLAN_NAME) => state.trainingsPlan.allIds.map((id) => state.trainingsPlan.byId[id]).find((p) => p.name === name)!;
const trainingAt = (state: GlobalState, planName: string, micro: number, slot: number) => state.trainings.byId[planOf(state, planName).trainings[`${micro},${slot}`]];
const setsOf = (state: GlobalState, trainingId: number) =>
  Object.entries(state.trainings.byId[trainingId].doneWorkoutIds).flatMap(([exerciseId, workoutId]) =>
    state.workouts.byId[workoutId].sets.map((s) => ({exercise: state.exercises.byId[Number(exerciseId)].name, weight: s.weight, reps: s.reps, rir: s.rir})),
  );

describe('CSV reader/writer', () => {
  it('round-trips umlauts, commas, quotes and line breaks', () => {
    const rows = [['Bankdrücken', 'a,b', 'say "hi"', 'line1\nline2', 'Kniebeuge; tief']];
    for (const delimiter of [',', ';']) {
      expect(parseCsv(serializeCsv(rows, delimiter), delimiter)).toEqual(rows);
    }
  });

  it('handles BOM, CRLF and detects the delimiter', () => {
    const text = '﻿Date,Workout Name\r\n2024-01-01 10:00:00,"Push, heavy"\r\n';
    expect(detectDelimiter(text)).toBe(',');
    expect(parseCsv(text, ',')).toEqual([
      ['Date', 'Workout Name'],
      ['2024-01-01 10:00:00', 'Push, heavy'],
    ]);
    expect(detectDelimiter(STRONG6_HEADER)).toBe(';');
  });

  it('parses Strong durations', () => {
    expect(parseStrongDuration('4419')).toBe(4419);
    expect(parseStrongDuration('1h 8m')).toBe(4080);
    expect(parseStrongDuration('42m')).toBe(2520);
    expect(parseStrongDuration('38min')).toBe(2280);
    expect(parseStrongDuration('')).toBeUndefined();
  });
});

describe('Strong export', () => {
  const state = baselineState();
  const exported = buildStrongExport(state);
  const rows = parseCsv(exported.csv, ';');

  it('writes the Strong 6.x header and one row per logged set', () => {
    expect(rows[0]).toEqual(STRONG_EXPORT_HEADER);
    const loggedSets = state.workouts.allIds.map((id) => state.workouts.byId[id]).filter((w) => w?.start !== undefined).reduce((sum, w) => sum + w.sets.length, 0);
    expect(loggedSets).toBe(5768);
    expect(exported.setCount).toBe(loggedSets);
    expect(rows.length - 1).toBe(loggedSets);
    expect(countLoggedSets(state)).toBe(loggedSets);
  });

  it('uses the training name as Workout Name and RPE = 10 − RIR', () => {
    // Training 381 (plan "Push pull", the last finished one) — compare every set with the store.
    const trainingId = 381;
    const training = state.trainings.byId[trainingId];
    const [planKey] = Object.entries(state.trainingsPlan.byId[5].trainings).find(([, id]) => id === trainingId)!;
    const expectedName = state.trainingsPlan.byId[5].trainingNames[getTrainingFromTrainingInMicroIndex(planKey)].trim();
    const date = formatStrongDate(new Date(training.start!));
    const sessionRows = rows.filter((r) => r[1] === date);
    const storeSets = Object.values(training.doneWorkoutIds).flatMap((wid) => state.workouts.byId[wid].sets);
    expect(sessionRows).toHaveLength(storeSets.length);
    sessionRows.forEach((r) => expect(r[2]).toBe(expectedName));
    const squatWorkout = state.workouts.byId[training.doneWorkoutIds[Number(Object.keys(training.doneWorkoutIds)[0])]];
    const exerciseName = state.exercises.byId[squatWorkout.exerciseId].name.trim();
    const exerciseRows = sessionRows.filter((r) => r[4] === exerciseName);
    expect(exerciseRows.map((r) => [Number(r[6]), Number(r[7]), Number(r[8])])).toEqual(squatWorkout.sets.map((s) => [s.weight, s.reps, 10 - s.rir]));
  });

  it('names sets logged outside a training "Exercise log"', () => {
    expect(rows.some((r) => r[2] === EXERCISE_LOG_WORKOUT_NAME)).toBe(true);
  });

  it('has nothing to export on an empty store', () => {
    expect(countLoggedSets(freshState())).toBe(0);
    expect(buildStrongExport(freshState()).setCount).toBe(0);
  });
});

describe('Strong import', () => {
  it('round-trips a Gainalytics export into an empty app as plan "Strong Import"', () => {
    const source = baselineState();
    const exported = buildStrongExport(source);
    const parsed = parseStrongCsv(exported.csv);
    // The baseline has one failed attempt (105 kg × 0); it is exported but not imported as a set.
    expect(parsed.skippedFailedSets).toBe(1);
    expect(parsed.setCount + parsed.skippedFailedSets).toBe(exported.setCount);

    const imported = importStrong(freshState(), exported.csv);
    const plan = planOf(imported);
    expect(plan).toBeDefined();
    const trainingIds = Object.values(plan.trainings);
    const importedSets = trainingIds.reduce((sum, id) => sum + setsOf(imported, id).length, 0);
    expect(importedSets).toBe(parsed.setCount);
    trainingIds.forEach((id) => expect(imported.trainings.byId[id].state).toBe(TrainingsState.FINISHED));

    // One training per calendar day, one micro per week.
    const days = new Set(parsed.sessions.map((s) => new Date(s.start).toDateString()));
    expect(trainingIds).toHaveLength(days.size);
    const micros = Object.keys(plan.trainings).map(getMicroFromTrainingInMicroIndex);
    const first = parsed.sessions[0].start;
    const last = parsed.sessions[parsed.sessions.length - 1].start;
    expect(Math.max(...micros)).toBeGreaterThanOrEqual(Math.floor((last - first) / (7 * 86400000)));

    // The last baseline training (381) lands with identical sets.
    const original = source.trainings.byId[381];
    const copyId = trainingIds.find((id) => Number(imported.trainings.byId[id].start) === Math.floor(Number(original.start) / 1000) * 1000)!;
    const originalSets = Object.values(original.doneWorkoutIds).flatMap((wid) => source.workouts.byId[wid].sets.map((s) => [s.weight, s.reps, s.rir]));
    const copiedSets = setsOf(imported, copyId).map((s) => [s.weight, s.reps, s.rir]);
    expect(copiedSets.sort()).toEqual(originalSets.sort());
    // Default exercises are reused, not duplicated.
    const names = imported.exercises.allIds.map((id) => imported.exercises.byId[id].name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps meaningful workout names (Push/Pull/Legs) as training names', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench Press (Barbell)', '1', '100.0', '5'),
      strong6Row(2, '2024-01-03 18:00:00', 'Pull', 'Deadlift (Barbell)', '1', '180.0', '3'),
      strong6Row(3, '2024-01-05 18:00:00', 'Legs', 'Squat (Barbell)', '1', '140.0', '5'),
      strong6Row(4, '2024-01-08 18:00:00', 'Push', 'Bench Press (Barbell)', '1', '102.5', '5'),
    );
    const state = importStrong(freshState(), csv);
    const plan = planOf(state);
    expect(plan.trainingNames).toEqual({1: 'Push', 2: 'Pull', 3: 'Legs'});
    expect(Object.keys(plan.trainings).sort()).toEqual(['1,1', '1,2', '1,3', '2,1']);
    expect(setsOf(state, plan.trainings['2,1'])).toEqual([{exercise: 'Bench Press (Barbell)', weight: 102.5, reps: 5, rir: 0}]);
  });

  it('gives a name trained twice in a week (A/B/A split) a second slot', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 18:00:00', 'Full body A', 'Squat', '1', '100', '5'),
      strong6Row(2, '2024-01-03 18:00:00', 'Full body B', 'Deadlift', '1', '140', '5'),
      strong6Row(3, '2024-01-05 18:00:00', 'Full body A', 'Squat', '1', '102.5', '5'),
      strong6Row(4, '2024-01-08 18:00:00', 'Full body B', 'Deadlift', '1', '145', '5'),
      strong6Row(5, '2024-01-10 18:00:00', 'Full body A', 'Squat', '1', '105', '5'),
      strong6Row(6, '2024-01-12 18:00:00', 'Full body B', 'Deadlift', '1', '150', '5'),
    );
    const state = importStrong(freshState(), csv);
    const plan = planOf(state);
    expect(plan.trainingNames).toEqual({1: 'Full body A', 2: 'Full body B', 3: 'Full body A', 4: 'Full body B'});
    expect(Object.keys(plan.trainings).sort()).toEqual(['1,1', '1,2', '1,3', '2,1', '2,2', '2,4']);
    expect(setsOf(state, plan.trainings['2,4'])[0].weight).toBe(150);
    expect(buildStrongImport(freshState(), parseStrongCsv(csv)).summary.trainingNames).toEqual(['Full body A', 'Full body B']);
  });

  it('falls back to weekdays for Strong default names', () => {
    expect(isDefaultWorkoutName('Evening Workout')).toBe(true);
    expect(isDefaultWorkoutName('Push')).toBe(false);
    const csv = strong6(
      strong6Row(1, '2024-01-01 07:00:00', 'Morning Workout', 'Squat', '1', '100', '5'),
      strong6Row(2, '2024-01-03 18:00:00', 'Evening Workout', 'Squat', '1', '100', '5'),
      strong6Row(3, '2024-01-12 18:00:00', 'Evening Workout', 'Squat', '1', '100', '5'),
    );
    const plan = planOf(importStrong(freshState(), csv));
    expect(plan.trainingNames).toEqual({1: 'Monday', 2: 'Wednesday', 3: 'Friday'});
    expect(Object.keys(plan.trainings).sort()).toEqual(['1,1', '1,2', '2,3']);
  });

  it('falls back to weekdays for more than 7 different names', () => {
    const rows = Array.from({length: 8}, (_, i) => strong6Row(i + 1, `2024-01-0${i + 1} 18:00:00`, `Day ${i + 1}`, 'Squat', '1', '100', '5'));
    const plan = planOf(importStrong(freshState(), strong6(...rows)));
    expect(Object.values(plan.trainingNames)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(Object.keys(plan.trainings)).toHaveLength(8);
  });

  it('merges two sessions on the same day into one training', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 08:00:00', 'Push', 'Bench Press', '1', '100', '5'),
      strong6Row(2, '2024-01-01 18:00:00', 'Pull', 'Deadlift', '1', '180', '3'),
      strong6Row(2, '2024-01-01 18:00:00', 'Pull', 'Bench Press', '1', '90', '8'),
    );
    const state = importStrong(freshState(), csv);
    const plan = planOf(state);
    expect(Object.keys(plan.trainings)).toEqual(['1,1']);
    expect(plan.trainingNames).toEqual({1: 'Push'});
    const sets = setsOf(state, plan.trainings['1,1']);
    expect(sets).toHaveLength(3);
    expect(sets.filter((s) => s.exercise === 'Bench Press').map((s) => s.weight)).toEqual([100, 90]);
  });

  it('converts pounds to kilograms (unit from header, assumed for old files, per row)', () => {
    const lbFile = strong6(strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench Press', '1', '225', '5')).replace('Weight (kg)', 'Weight (lb)');
    expect(setsOf(importStrong(freshState(), lbFile), planOf(importStrong(freshState(), lbFile)).trainings['1,1'])[0].weight).toBe(102.06);

    const legacy = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n2020-12-30 18:51:52,"Evening Workout",2h 38m,"Snatch (Barbell)",1,100.0,3,0,0,"","",\n';
    expect(parseStrongCsv(legacy).weightUnit).toBeUndefined();
    const asKg = importStrong(freshState(), legacy);
    expect(setsOf(asKg, planOf(asKg).trainings['1,1'])[0].weight).toBe(100);
    const asLb = importStrong(freshState(), legacy, {assumedWeightUnit: 'lb'});
    expect(setsOf(asLb, planOf(asLb).trainings['1,1'])[0].weight).toBe(45.36);
    const legacyTraining = trainingAt(asKg, STRONG_IMPORT_PLAN_NAME, 1, 1);
    expect(Number(legacyTraining.end) - Number(legacyTraining.start)).toBe((2 * 60 + 38) * 60 * 1000);

    const perRow = 'Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps\n2024-01-01 10:00:00;A;Squat;1;220;lbs;5\n2024-01-01 10:00:00;A;Squat;2;100;kg;5\n';
    const perRowState = importStrong(freshState(), perRow);
    expect(setsOf(perRowState, planOf(perRowState).trainings['1,1']).map((s) => s.weight)).toEqual([99.79, 100]);
  });

  it('maps RPE to RIR = 10 − RPE, keeping decimal RPEs (missing RPE → RIR 0)', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '1', '100', '5', '8'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '2', '100', '5', '9.5'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '3', '100', '5', '8.7'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '4', '100', '5', ''),
    );
    const state = importStrong(freshState(), csv);
    expect(setsOf(state, planOf(state).trainings['1,1']).map((s) => s.rir)).toEqual([2, 0.5, 1.3, 0]);
    // …and back: exporting the imported sets writes the same RPEs again.
    const rows = parseCsv(buildStrongExport(state).csv, ';');
    expect(rows.slice(1).map((row) => row[8])).toEqual(['8', '9.5', '8.7', '10']);
  });

  it('rejects malformed weights and reps with the line number, allows empty weights of bodyweight exercises', () => {
    const bench = (order: string, weight: string, reps = '5') => strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', order, weight, reps);
    expect(() => parseStrongCsv(strong6(bench('1', '100'), bench('2', 'abc')))).toThrow(new StrongCsvError('Line 3: "abc" is not a valid weight.'));
    expect(() => parseStrongCsv(strong6(bench('1', '100'), bench('2', '100', 'five')))).toThrow(new StrongCsvError('Line 3: "five" is not a valid number of reps.'));
    // An empty weight on an exercise that is weighted elsewhere is a damaged row, wherever it is in the file.
    expect(() => parseStrongCsv(strong6(bench('1', ''), bench('2', '100')))).toThrow(new StrongCsvError('Line 2: the weight is missing.'));
    // Strong writes reps-only (bodyweight) exercises without a weight: imported as 0 kg.
    const pullUps = strong6(bench('1', '100'), strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Pull Up', '1', '', '10'), strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Pull Up', '2', '', '8'));
    const state = importStrong(freshState(), pullUps);
    expect(setsOf(state, planOf(state).trainings['1,1'])).toEqual([
      {exercise: 'Bench', weight: 100, reps: 5, rir: 0},
      {exercise: 'Pull Up', weight: 0, reps: 10, rir: 0},
      {exercise: 'Pull Up', weight: 0, reps: 8, rir: 0},
    ]);
  });

  it('keeps umlauts, commas and quotes in names', () => {
    const legacy =
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n' +
      '2024-01-01 18:00:00,"Oberkörper, schwer",1h,"Bankdrücken ""eng""",1,80.0,5,0,0,"","",\n';
    const state = importStrong(freshState(), legacy);
    const plan = planOf(state);
    expect(plan.trainingNames).toEqual({1: 'Oberkörper, schwer'});
    expect(setsOf(state, plan.trainings['1,1'])[0].exercise).toBe('Bankdrücken "eng"');
  });

  it('skips cardio, rest timer and note rows', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '1', '100', '5'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', 'Rest Timer', '', '', '', '', '120.0'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Running', '1', '', '', '', '5000', '1500'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', 'Note', '', ''),
    );
    const parsed = parseStrongCsv(csv);
    expect(parsed.setCount).toBe(1);
    expect(parsed.skippedCardioRows).toBe(1);
    expect(parsed.skippedOtherRows).toBe(2);
    const state = importStrong(freshState(), csv);
    expect(state.exercises.allIds.map((id) => state.exercises.byId[id].name)).not.toContain('Running');
  });

  it('does not import the same file twice', () => {
    const csv = strong6(strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '1', '100', '5'), strong6Row(2, '2024-01-03 18:00:00', 'Pull', 'Row', '1', '60', '10'));
    const once = importStrong(freshState(), csv);
    const result = buildStrongImport(once, parseStrongCsv(csv));
    expect(result.summary.duplicateSessionCount).toBe(2);
    expect(result.summary.trainingCount).toBe(0);
    expect(result.state).toBe(once);
    const twice = importStrong(once, csv);
    expect(twice.trainingsPlan.allIds).toEqual(once.trainingsPlan.allIds);
    expect(twice.workouts).toBe(once.workouts);
    // Sessions merged into another training of the same day are recognised, too.
    const sameDay = strong6(strong6Row(1, '2024-01-01 08:00:00', 'Push', 'Bench', '1', '100', '5'), strong6Row(2, '2024-01-01 18:00:00', 'Pull', 'Row', '1', '60', '10'));
    const merged = importStrong(freshState(), sameDay);
    expect(buildStrongImport(merged, parseStrongCsv(sameDay)).summary).toEqual(expect.objectContaining({trainingCount: 0, duplicateSessionCount: 2}));
    // The round trip: a Gainalytics export re-imported into the app it was imported into adds nothing.
    const roundTrip = importStrong(freshState(), buildStrongExport(baselineState()).csv);
    expect(buildStrongImport(roundTrip, parseStrongCsv(buildStrongExport(baselineState()).csv)).summary.trainingCount).toBe(0);
    // A Gainalytics export imported back into the same app is all duplicates, too.
    const baseline = baselineState();
    expect(buildStrongImport(baseline, parseStrongCsv(buildStrongExport(baseline).csv)).summary.trainingCount).toBe(0);
  });

  it('reuses existing exercises and never creates one twice', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'bench press ', '1', '100', '5'),
      strong6Row(2, '2024-01-03 18:00:00', 'Push', 'Pendulum Squat', '1', '200', '10'),
      strong6Row(3, '2024-01-05 18:00:00', 'Push', 'PENDULUM  SQUAT', '1', '200', '10'),
    );
    const before = freshState();
    const state = importStrong(before, csv);
    expect(state.exercises.allIds).toHaveLength(before.exercises.allIds.length + 1);
    const bench = before.exercises.allIds.find((id) => before.exercises.byId[id].name === 'Bench Press')!;
    expect(state.workouts.byExerciseId[bench]).toHaveLength(1);
  });

  it('rejects invalid files without changing the store', () => {
    expect(() => parseStrongCsv('')).toThrow(StrongCsvError);
    expect(() => parseStrongCsv('name,value\nfoo,1\n')).toThrow(/missing column/);
    expect(() => parseStrongCsv(strong6(strong6Row(1, 'yesterday', 'Push', 'Bench', '1', '100', '5')))).toThrow(/Line 2/);
    expect(() => parseStrongCsv(strong6(strong6Row(1, '2024-01-01 18:00:00', 'Run', 'Running', '1', '', '', '', '5000', '1500')))).toThrow(/no strength sets/);
    // A bad row late in the file aborts the whole parse — nothing reaches the store.
    const lateError = strong6(strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Bench', '1', '100', '5'), strong6Row(2, '2024-13-45 18:00:00', 'Push', 'Bench', '1', '100', '5'));
    expect(() => parseStrongCsv(lateError)).toThrow(/Line 3/);
  });

  it('computes 1RM records for imported exercises', () => {
    const csv = strong6(strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Leg Press', '1', '200', '5'), strong6Row(2, '2024-01-08 18:00:00', 'Push', 'Leg Press', '1', '210', '5'));
    const state = importStrong(freshState(), csv);
    const id = state.exercises.allIds.find((i) => state.exercises.byId[i].name === 'Leg Press')!;
    expect(state.exercises.byId[id].records!['1RM']).toHaveLength(2);
  });

  it('skips failed attempts (0 reps with a weight) so they never become a 1RM record', () => {
    const csv = strong6(
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Leg Press', '1', '200', '5', '9'),
      strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Leg Press', '2', '300', '0'),
      strong6Row(2, '2024-01-08 18:00:00', 'Push', 'Leg Press', '1', '320', '0', '10'),
    );
    const parsed = parseStrongCsv(csv);
    expect(parsed.setCount).toBe(1);
    expect(parsed.skippedFailedSets).toBe(2);
    // The second session has only a failed attempt, so it is no workout at all.
    expect(parsed.sessions).toHaveLength(1);
    const result = buildStrongImport(freshState(), parsed);
    expect(result.summary).toEqual(expect.objectContaining({setCount: 1, trainingCount: 1, skippedFailedSets: 2}));
    const state = importStrong(freshState(), csv);
    const id = state.exercises.allIds.find((i) => state.exercises.byId[i].name === 'Leg Press')!;
    const workouts = state.workouts.byExerciseId[id].map((w) => state.workouts.byId[w]);
    expect(workouts.flatMap((w) => w.sets).map((s) => [s.weight, s.reps])).toEqual([[200, 5]]);
    // 200 × (1 + (5 + 1) / 30) = 240, not 300/320 from the failed attempts.
    expect(state.exercises.byId[id].records!['1RM'].map((r) => Number(r.value))).toEqual([240]);
    expect(workouts[0].records!['1RM']).toBe(240);
    // A file of failed attempts only has nothing to import.
    expect(() => parseStrongCsv(strong6(strong6Row(1, '2024-01-01 18:00:00', 'Push', 'Leg Press', '1', '300', '0')))).toThrow(/no strength sets/);
  });

  it('rebuilds the record history in date order for exercises that already had records', () => {
    // Existing history: one Leg Press record in February (100 × 5 → 116.67).
    const existing = importStrong(freshState(), strong6(strong6Row(1, '2024-02-01 18:00:00', 'Push', 'Leg Press', '1', '100', '5')));
    const id = existing.exercises.allIds.find((i) => existing.exercises.byId[i].name === 'Leg Press')!;
    const febWorkout = existing.workouts.byExerciseId[id][0];
    expect(existing.exercises.byId[id].records!['1RM'].map((r) => Number(r.value))).toEqual([116.67]);

    // Import: an older lower set (Jan 1), an older higher set (Jan 15, beats February), a new best (March).
    const state = importStrong(
      existing,
      strong6(
        strong6Row(1, '2024-01-01 18:00:00', 'Pull', 'Leg Press', '1', '90', '5'),
        strong6Row(2, '2024-01-15 18:00:00', 'Pull', 'Leg Press', '1', '105', '5'),
        strong6Row(3, '2024-03-01 18:00:00', 'Pull', 'Leg Press', '1', '120', '5'),
      ),
    );
    const startOf = (workoutId: number) => new Date(state.workouts.byId[workoutId].start!).toISOString().slice(0, 10);
    const history = state.exercises.byId[id].records!['1RM'];
    expect(history.map((r) => [startOf(r.workoutId), Number(r.value)])).toEqual([
      ['2024-01-01', 105],
      ['2024-01-15', 122.5],
      ['2024-03-01', 140],
    ]);
    // February is no record any more (Jan 15 was heavier) — the Records screen must not list it.
    expect(state.workouts.byId[febWorkout].records?.['1RM']).toBeUndefined();
    // The imported new best carries the workout record the Records screen filters for.
    expect(state.workouts.byId[history[2].workoutId].records!['1RM']).toBe(140);
  });

  it('adds an imported new best to the baseline record history of an existing exercise', () => {
    const baseline = baselineState();
    const squat = baseline.exercises.allIds.find((i) => baseline.exercises.byId[i].name === 'Squat')!;
    const before = baseline.exercises.byId[squat].records!['1RM'];
    const best = Math.max(...before.map((r) => Number(r.value)));
    // 200 kg × 5 @ RPE 9 → 240 > the baseline best (225); the failed 260 kg single must not count.
    const state = importStrong(
      baseline,
      strong6(strong6Row(1, '2026-10-05 18:00:00', 'Legs', 'Squat', '1', '200', '5', '9'), strong6Row(1, '2026-10-05 18:00:00', 'Legs', 'Squat', '2', '260', '0')),
    );
    const history = state.exercises.byId[squat].records!['1RM'];
    const last = history[history.length - 1];
    expect(best).toBeLessThan(240);
    expect(Number(last.value)).toBe(240);
    expect(state.workouts.byId[last.workoutId].records!['1RM']).toBe(240);
    expect(state.workouts.byId[last.workoutId].trainingsId).toBe(planOf(state).trainings['1,1']);
    // The rebuilt history is chronological and strictly increasing, and every entry is tagged on its workout.
    const starts = history.map((r) => new Date(state.workouts.byId[r.workoutId].start!).getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    history.slice(1).forEach((r, i) => expect(Number(r.value)).toBeGreaterThan(Number(history[i].value)));
    history.forEach((r) => expect(state.workouts.byId[r.workoutId].records!['1RM']).toBe(Number(r.value)));
  });
});
