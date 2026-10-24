import {planHealthConnectSync} from '../../../app/utils/healthConnect/healthConnectSync';
import {healthConnectFingerprint, mapTrainingToHealthConnectSession} from '../../../app/utils/healthConnect/healthConnectMapping';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {Exercise} from '../../../app/models/entities/Exercise';
import {GlobalState} from '../../../app/redux/rootReducer';
import {HealthConnectState} from '../../../app/redux/HealthConnect/healthConnectReducer';

type SyncState = Pick<GlobalState, 'trainings' | 'workouts' | 'exercises' | 'healthConnect'>;

const START = Date.UTC(2026, 9, 20, 17, 0);
const END = Date.UTC(2026, 9, 20, 18, 0);
const NOW = 5000;

const exercises: {[id: number]: Exercise} = {1: {id: 1, name: 'Squat'}, 2: {id: 2, name: 'Bench press'}};
const workouts: {[id: number]: Workout} = {
  10: {id: 10, exerciseId: 1, sets: [{reps: 5, weight: 100, rir: 2}]},
  20: {id: 20, exerciseId: 2, sets: [{reps: 8, weight: 70, rir: 1}]},
};
const finished = (id: number, exerciseId: number, workoutId: number): Training => ({
  id,
  state: TrainingsState.FINISHED,
  start: new Date(START),
  end: new Date(END),
  exercises: [exerciseId],
  doneWorkoutIds: {[exerciseId]: workoutId},
  plannedWorkouts: {},
});

const buildState = (trainings: {[id: number]: Training}, healthConnect: Partial<HealthConnectState>, workoutsById = workouts, exercisesById = exercises): SyncState => ({
  trainings: {byId: trainings, allIds: Object.keys(trainings).map(Number)},
  workouts: {byId: workoutsById, allIds: Object.keys(workoutsById).map(Number), byExerciseId: {}, plannedWorkouts: []},
  exercises: {byId: exercisesById, allIds: Object.keys(exercisesById).map(Number)},
  healthConnect: {writeEnabled: true, everConnected: true, written: {}, ...healthConnect},
});

const writeOpFor = (state: SyncState, trainingId: number) => {
  const session = mapTrainingToHealthConnectSession(state.trainings.byId[trainingId], state.workouts.byId, state.exercises.byId, NOW)!;
  return {kind: 'write', trainingId, session, fingerprint: healthConnectFingerprint(session)};
};

describe('GH-528 planHealthConnectSync', () => {
  const started: Training = {...finished(1, 1, 10), state: TrainingsState.STARTED, end: undefined};

  it('writes a training when it is finished', () => {
    const prev = buildState({1: started}, {});
    const next = buildState({1: finished(1, 1, 10)}, {});

    expect(planHealthConnectSync(prev, next, {type: 'FINISH_TRAINING', trainingsId: 1}, NOW)).toEqual([writeOpFor(next, 1)]);
  });

  it('does nothing while writing is switched off', () => {
    const prev = buildState({1: started}, {writeEnabled: false});
    const next = buildState({1: finished(1, 1, 10)}, {writeEnabled: false, written: {2: 'old'}});

    expect(planHealthConnectSync(prev, next, {type: 'FINISH_TRAINING', trainingsId: 1}, NOW)).toEqual([]);
  });

  it('rewrites a written training when its sets change and leaves unchanged ones alone', () => {
    const before = buildState({1: finished(1, 1, 10), 2: finished(2, 2, 20)}, {});
    const written = {1: writeOpFor(before, 1).fingerprint, 2: writeOpFor(before, 2).fingerprint};
    const prev = buildState(before.trainings.byId, {written});
    const next = buildState(before.trainings.byId, {written}, {...workouts, 10: {...workouts[10], sets: [{reps: 5, weight: 105, rir: 2}]}});

    expect(planHealthConnectSync(prev, next, {type: 'ADD_OR_UPDATE_SET'}, NOW)).toEqual([writeOpFor(next, 1)]);
  });

  it('rewrites a written training when the exercise gets another Health Connect type', () => {
    const prev = buildState({1: finished(1, 1, 10)}, {});
    const written = {1: writeOpFor(prev, 1).fingerprint};
    const next = buildState({1: finished(1, 1, 10)}, {written}, workouts, {...exercises, 1: {id: 1, name: 'Squat', healthConnectType: 'LEG_PRESS'}});

    const ops = planHealthConnectSync({...prev, healthConnect: next.healthConnect}, next, {type: 'EDIT_EXERCISE'}, NOW);

    expect(ops).toEqual([writeOpFor(next, 1)]);
    expect(writeOpFor(next, 1).session.segments.map((segment) => segment.segmentType)).toEqual(['LEG_PRESS']);
  });

  it('deletes a written training that was deleted or reopened', () => {
    const written = {1: 'fp-1', 2: 'fp-2'};
    const prev = buildState({1: finished(1, 1, 10), 2: finished(2, 2, 20)}, {written});
    const next = buildState({2: {...finished(2, 2, 20), state: TrainingsState.STARTED}}, {written});

    expect(planHealthConnectSync(prev, next, {type: 'DELETE_TRAINING', trainingsId: 1}, NOW)).toEqual([
      {kind: 'delete', trainingId: 1, clientRecordId: 'gainalytics-training-1'},
      {kind: 'delete', trainingId: 2, clientRecordId: 'gainalytics-training-2'},
    ]);
  });

  it('does not write again when finishing a training whose content is already in Health Connect', () => {
    const next = buildState({1: finished(1, 1, 10)}, {});
    const written = {1: writeOpFor(next, 1).fingerprint};

    expect(planHealthConnectSync(buildState({1: started}, {written}), buildState({1: finished(1, 1, 10)}, {written}), {type: 'FINISH_TRAINING', trainingsId: 1}, NOW)).toEqual([]);
  });

  it('never writes imported trainings and ignores trainings that were never written', () => {
    const prev = buildState({}, {});
    const imported = buildState({1: finished(1, 1, 10), 2: finished(2, 2, 20)}, {});

    expect(planHealthConnectSync(prev, imported, {type: 'FULL_IMPORT'}, NOW)).toEqual([]);
    expect(planHealthConnectSync(prev, imported, {type: 'STRONG_IMPORT'}, NOW)).toEqual([]);
    expect(planHealthConnectSync(prev, imported, {type: 'EDIT_TRAINING_TIMES'}, NOW)).toEqual([]);
  });

  it('skips the comparison when no training data changed', () => {
    const state = buildState({}, {written: {1: 'fp-1'}});

    expect(planHealthConnectSync(state, state, {type: 'TOGGLE_DISABLE_TIMER'}, NOW)).toEqual([]);
  });
});
