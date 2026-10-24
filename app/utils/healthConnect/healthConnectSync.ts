/**
 * GH-528 (T2): decides which Health Connect writes/deletes an action causes.
 *
 * - Finishing a training (FINISH_TRAINING) writes it.
 * - A training that was written before is rewritten when its mapped content changes (sets,
 *   times, exercise names or types), and deleted when it is deleted or no longer finished.
 * - Nothing happens while writing is switched off, and imports never write anything: old
 *   trainings are not transferred automatically.
 * - Writes/deletes still running count as done: a training edited or deleted before its first
 *   write finished is reconciled right away instead of staying stale in Health Connect.
 */
import {AnyAction} from 'redux';
import {GlobalState} from '../../redux/rootReducer';
import {clientRecordIdForTraining, HealthConnectSessionInput, healthConnectFingerprint, mapTrainingToHealthConnectSession} from './healthConnectMapping';

type WriteOp = {kind: 'write'; trainingId: number; session: HealthConnectSessionInput; fingerprint: string};
type DeleteOp = {kind: 'delete'; trainingId: number; clientRecordId: string};
export type HealthConnectSyncOp = WriteOp | DeleteOp;

type SyncState = Pick<GlobalState, 'trainings' | 'workouts' | 'exercises' | 'healthConnect'>;

/** trainingId → fingerprint of a write still running, or 'delete' for a delete still running. */
export type InFlightOps = ReadonlyMap<number, string>;

const IMPORT_ACTIONS = ['FULL_IMPORT', 'STRONG_IMPORT', 'IMPORT_TRAININGS_PLAN'];

const writeOp = (state: SyncState, trainingId: number, now: number): WriteOp | undefined => {
  const training = state.trainings.byId[trainingId];
  const session = training ? mapTrainingToHealthConnectSession(training, state.workouts.byId, state.exercises.byId, now, state.healthConnect?.recordNamespace) : null;
  return session ? {kind: 'write', trainingId, session, fingerprint: healthConnectFingerprint(session)} : undefined;
};

export const planHealthConnectSync = (prev: SyncState, next: SyncState, action: AnyAction, now: number = Date.now(), inFlight: InFlightOps = new Map()): HealthConnectSyncOp[] => {
  if (!next.healthConnect?.writeEnabled || IMPORT_ACTIONS.includes(action.type)) return [];

  const ops: HealthConnectSyncOp[] = [];
  // What Health Connect will hold once the running ops are done.
  const written: {[trainingId: number]: string} = {...(next.healthConnect.written ?? {})};
  inFlight.forEach((key, trainingId) => {
    if (key === 'delete') delete written[trainingId];
    else written[trainingId] = key;
  });

  if (action.type === 'FINISH_TRAINING' && typeof action.trainingsId === 'number') {
    const op = writeOp(next, action.trainingsId, now);
    if (op && written[action.trainingsId] !== op.fingerprint) ops.push(op);
  }

  const dataChanged = prev.trainings !== next.trainings || prev.workouts !== next.workouts || prev.exercises !== next.exercises;
  if (!dataChanged) return ops;

  Object.keys(written)
    .map(Number)
    .filter((trainingId) => !ops.some((op) => op.trainingId === trainingId))
    .forEach((trainingId) => {
      const op = writeOp(next, trainingId, now);
      if (!op) ops.push({kind: 'delete', trainingId, clientRecordId: clientRecordIdForTraining(trainingId, next.healthConnect?.recordNamespace)});
      else if (op.fingerprint !== written[trainingId]) ops.push(op);
    });
  return ops;
};
