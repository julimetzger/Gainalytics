import trainingsReducer from '../../../app/redux/Training/trainingsReducer';
import trainingsPlanReducer from '../../../app/redux/Training/trainingsPlanReducer';
import {planHealthConnectSync} from '../../../app/utils/healthConnect/healthConnectSync';
import {HealthConnectSessionInput, healthConnectFingerprint} from '../../../app/utils/healthConnect/healthConnectMapping';
import {NormalizedState} from '../../../app/redux/normalizedState';
import {Training} from '../../../app/models/entities/Training';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {GlobalState} from '../../../app/redux/rootReducer';

const START = Date.UTC(2026, 10, 1, 17, 0);
const END = Date.UTC(2026, 10, 1, 18, 0);
const NOW = 5000;

const RUNNING: Training = {
  id: 3,
  state: TrainingsState.STARTED,
  start: new Date(START),
  exercises: [1, 2],
  doneWorkoutIds: {1: 10},
  plannedWorkouts: {1: 30, 2: 31},
};

const trainings = (training: Training = RUNNING) => ({byId: {3: training}, allIds: [3]}) satisfies NormalizedState<Training>;

const plan = (lastTraining?: number) =>
  ({
    byId: {
      1: {id: 1, name: 'plan', trainings: {'1,1': 3}, trainingNames: {}, mesos: [], ...(lastTraining !== undefined ? {lastTraining} : {})} satisfies TrainingsPlan,
    },
    allIds: [1],
  });

const finish = {type: 'FINISH_TRAINING', trainingsId: 3, trainingsPlanId: 1, date: new Date(END)};
const reopen = (previousLastTraining?: number) => ({type: 'REOPEN_TRAINING', trainingsId: 3, trainingsPlanId: 1, previousLastTraining});

describe('GH-623 REOPEN_TRAINING (undo of FINISH_TRAINING)', () => {
  it('restores the running training exactly: state STARTED, no end, same start and workouts', () => {
    const finished = trainingsReducer(trainings(), finish);
    expect(finished.byId[3]).toEqual({...RUNNING, state: TrainingsState.FINISHED, end: new Date(END)});

    const reopened = trainingsReducer(finished, reopen(2));
    expect(reopened).toEqual(trainings());
    expect('end' in reopened.byId[3]).toBe(false);
  });

  it('leaves a training that is not finished alone', () => {
    const state = trainings();
    expect(trainingsReducer(state, reopen(2))).toBe(state);
  });

  it('a training that stays finished (no undo) keeps state and end', () => {
    const finished = trainingsReducer(trainings(), finish);
    expect(trainingsReducer(finished, {type: 'SOMETHING_ELSE'}).byId[3]).toEqual({...RUNNING, state: TrainingsState.FINISHED, end: new Date(END)});
  });

  it('hands lastTraining back to the previous training', () => {
    const finished = trainingsPlanReducer(plan(2), finish);
    expect(finished.byId[1].lastTraining).toBe(3);
    expect(trainingsPlanReducer(finished, reopen(2))).toEqual(plan(2));
  });

  it('removes lastTraining when the plan had none before (first training of the plan)', () => {
    const finished = trainingsPlanReducer(plan(), finish);
    expect(trainingsPlanReducer(finished, reopen(undefined))).toEqual(plan());
  });

  it('keeps lastTraining when another training was finished in between', () => {
    const state = plan(7);
    expect(trainingsPlanReducer(state, reopen(2))).toBe(state);
  });

  it('finish → undo → finish ends in the same state as a single finish', () => {
    const once = trainingsReducer(trainings(), finish);
    const twice = trainingsReducer(trainingsReducer(once, reopen(2)), finish);
    expect(twice).toEqual(once);
    const planOnce = trainingsPlanReducer(plan(2), finish);
    expect(trainingsPlanReducer(trainingsPlanReducer(planOnce, reopen(2)), finish)).toEqual(planOnce);
  });
});

describe('GH-623 Health Connect across finish → undo → finish', () => {
  type SyncState = Pick<GlobalState, 'trainings' | 'workouts' | 'exercises' | 'healthConnect'>;
  const build = (trainingsState: NormalizedState<Training>, written: {[id: number]: string}): SyncState => ({
    trainings: trainingsState,
    workouts: {byId: {10: {id: 10, exerciseId: 1, sets: [{reps: 5, weight: 100, rir: 2}], end: new Date(END)}}, allIds: [10], byExerciseId: {}, plannedWorkouts: []},
    exercises: {byId: {1: {id: 1, name: 'Squat'}, 2: {id: 2, name: 'Bench press'}}, allIds: [1, 2]},
    healthConnect: {writeEnabled: true, everConnected: true, written},
  });

  it('writes once, deletes on undo and rewrites the same record — never a second entry', () => {
    const running = trainings();
    const finished = trainingsReducer(running, finish);
    const session = {
      clientRecordId: 'gainalytics-training-3',
      clientRecordVersion: NOW,
      title: 'Gainalytics: Squat',
      notes: 'Squat: 5 × 100 kg @ RIR 2',
      startMs: START,
      endMs: END,
      segments: [{startMs: START, endMs: END, segmentType: 'SQUAT', repetitions: 5, exerciseName: 'Squat'}],
    } satisfies HealthConnectSessionInput;
    const firstWrite = {kind: 'write', trainingId: 3, session, fingerprint: healthConnectFingerprint(session)};
    expect(planHealthConnectSync(build(running, {}), build(finished, {}), finish, NOW)).toEqual([firstWrite]);
    const written = {3: firstWrite.fingerprint};

    const reopened = trainingsReducer(finished, reopen(2));
    expect(planHealthConnectSync(build(finished, written), build(reopened, written), reopen(2), NOW)).toEqual([
      {kind: 'delete', trainingId: 3, clientRecordId: 'gainalytics-training-3'},
    ]);

    const finishedAgain = trainingsReducer(reopened, finish);
    const ops = planHealthConnectSync(build(reopened, {}), build(finishedAgain, {}), finish, NOW);
    expect(ops).toEqual([firstWrite]);
    expect(ops[0].kind === 'write' && ops[0].session.clientRecordId).toBe('gainalytics-training-3');
  });

  it('undo while the first write is still running deletes it afterwards', () => {
    const finished = trainingsReducer(trainings(), finish);
    const [firstWrite] = planHealthConnectSync(build(trainings(), {}), build(finished, {}), finish, NOW);
    const inFlight = new Map([[3, firstWrite.kind === 'write' ? firstWrite.fingerprint : '']]);
    const reopened = trainingsReducer(finished, reopen(2));

    expect(planHealthConnectSync(build(finished, {}), build(reopened, {}), reopen(2), NOW, inFlight)).toEqual([
      {kind: 'delete', trainingId: 3, clientRecordId: 'gainalytics-training-3'},
    ]);
  });
});
