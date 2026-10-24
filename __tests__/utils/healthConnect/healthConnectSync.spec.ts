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
  const session = mapTrainingToHealthConnectSession(state.trainings.byId[trainingId], state.workouts.byId, state.exercises.byId, NOW, state.healthConnect?.recordNamespace)!;
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

  describe('writes and deletes still running (Codex review)', () => {
    const finishedState = buildState({1: finished(1, 1, 10)}, {});
    const firstWrite = writeOpFor(finishedState, 1);
    const inFlight = new Map([[1, firstWrite.fingerprint]]);

    it('does not queue the same write again while it is running', () => {
      const prev = buildState({1: started}, {});

      expect(planHealthConnectSync(prev, finishedState, {type: 'FINISH_TRAINING', trainingsId: 1}, NOW, inFlight)).toEqual([]);
    });

    it('deletes a training that was deleted before its first write finished', () => {
      const next = buildState({}, {});

      expect(planHealthConnectSync(finishedState, next, {type: 'DELETE_TRAINING', trainingsId: 1}, NOW, inFlight)).toEqual([{kind: 'delete', trainingId: 1, clientRecordId: 'gainalytics-training-1'}]);
    });

    it('rewrites a training that was edited before its first write finished', () => {
      const editedWorkouts = {...workouts, 10: {id: 10, exerciseId: 1, sets: [{reps: 5, weight: 110, rir: 2}]}};
      const next = buildState({1: finished(1, 1, 10)}, {}, editedWorkouts);

      expect(planHealthConnectSync(finishedState, next, {type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'}, NOW, inFlight)).toEqual([writeOpFor(next, 1)]);
    });

    it('does not delete again while a delete is running', () => {
      const prev = buildState({1: finished(1, 1, 10)}, {written: {1: firstWrite.fingerprint}});
      const next = buildState({}, {written: {1: firstWrite.fingerprint}});

      expect(planHealthConnectSync(prev, next, {type: 'DELETE_TRAINING', trainingsId: 1}, NOW, new Map([[1, 'delete']]))).toEqual([]);
    });
  });

  it('uses the record namespace for written and deleted entries', () => {
    const prev = buildState({1: started}, {recordNamespace: 'ns1'});
    const next = buildState({1: finished(1, 1, 10)}, {recordNamespace: 'ns1'});
    const [op] = planHealthConnectSync(prev, next, {type: 'FINISH_TRAINING', trainingsId: 1}, NOW);

    expect(op).toEqual(writeOpFor(next, 1));
    expect(op.kind === 'write' && op.session.clientRecordId).toBe('gainalytics-ns1-training-1');
    expect(
      planHealthConnectSync(
        buildState({1: finished(1, 1, 10)}, {recordNamespace: 'ns1', written: {1: 'x'}}),
        buildState({}, {recordNamespace: 'ns1', written: {1: 'x'}}),
        {type: 'DELETE_TRAINING'},
        NOW,
      ),
    ).toEqual([{kind: 'delete', trainingId: 1, clientRecordId: 'gainalytics-ns1-training-1'}]);
  });
});
