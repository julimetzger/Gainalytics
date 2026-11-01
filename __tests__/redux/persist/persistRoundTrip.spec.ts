import fs from 'fs';
import path from 'path';

// GH-671: the real store (configureStore: redux-persist + incremental storage + all reducers) on an
// in-memory MMKV. Data written by one "process" must be complete in the next one — starting from the
// legacy single-value layout that every existing install has on disk.

const mockMmkv = new Map<string, string>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockMmkv.get(key),
    set: (key: string, value: string) => mockMmkv.set(key, value),
    remove: (key: string) => mockMmkv.delete(key),
    getAllKeys: () => [...mockMmkv.keys()],
  }),
}));

jest.mock('../../../app/redux/HealthConnect/healthConnectMiddleware', () => ({
  healthConnectMiddleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action),
}));

const PERSISTED_SLICES = ['exercises', 'workouts', 'trainingsPlan', 'trainings', 'videoAnalyses', 'settings'];
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../../e2e/maestro/fixtures/baseline.gains'), 'utf8'));

/** `persist:root` as redux-persist v6 wrote it before GH-671 (slices JSON-encoded twice). */
const legacyRootValue = () => {
  const raw: Record<string, string> = {};
  PERSISTED_SLICES.forEach((slice) => (raw[slice] = JSON.stringify(baseline[slice])));
  raw._persist = JSON.stringify({version: 14, rehydrated: true});
  return JSON.stringify(raw);
};

/** A fresh app process: new modules (and storage instance) over the same MMKV contents. */
const startApp = async () => {
  let created: any;
  jest.isolateModules(() => {
    created = require('../../../configureStore').default();
  });
  const {store, persistor} = created;
  await new Promise<void>((resolve) => {
    if (persistor.getState().bootstrapped) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
  return {store, persistor};
};

/** What survives a restart: the persisted slices, through JSON like on disk. */
const persistedPart = (state: any) =>
  JSON.parse(
    JSON.stringify({
      ...Object.fromEntries(PERSISTED_SLICES.filter((slice) => slice !== 'workouts').map((slice) => [slice, state[slice]])),
      workouts: {byId: state.workouts.byId, allIds: state.workouts.allIds, byExerciseId: state.workouts.byExerciseId, plannedWorkouts: state.workouts.plannedWorkouts},
    }),
  );

describe('persisted state across app restarts (GH-671)', () => {
  beforeEach(() => mockMmkv.clear());

  it('migrates the legacy value and keeps every logged set, the finalized workout and the rest timer after a restart', async () => {
    mockMmkv.set('persist:root', legacyRootValue());

    const first = await startApp();
    expect(first.store.getState().workouts.allIds).toHaveLength(baseline.workouts.allIds.length);

    const start = new Date('2026-11-01T10:00:00.000Z');
    first.store.dispatch({type: 'ADD_WORKOUT', workout: {sets: [{index: 1, reps: 5, weight: 20, rir: 0, date: start}], notes: '', exerciseId: 1, start}});
    const workoutId = first.store.getState().workouts.notFinishedWorkouts[1];
    first.store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId, set: {reps: 5, weight: 20, rir: 0, date: start}});
    first.store.dispatch({type: 'START_REST_TIMER', startedAt: 1000, targetSeconds: 90, exerciseId: 1, setIndex: 2});
    await first.persistor.flush();
    // Later writes are incremental: each must still carry its change.
    first.store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId, set: {reps: 6, weight: 22.5, rir: 1, date: start}});
    await first.persistor.flush();
    first.store.dispatch({type: 'FINALIZE_WORKOUT', workoutId, end: new Date('2026-11-01T10:30:00.000Z')});
    await first.persistor.flush();

    // The legacy value is gone once the new layout is committed.
    expect(mockMmkv.has('persist:root')).toBe(false);
    expect(mockMmkv.has('persist:root:manifest')).toBe(true);

    const second = await startApp();
    const restored = second.store.getState();
    expect(persistedPart(restored)).toEqual(persistedPart(first.store.getState()));
    expect(restored.workouts.byId[workoutId]).toEqual({
      id: workoutId,
      exerciseId: 1,
      notes: '',
      start: start.toISOString(),
      end: '2026-11-01T10:30:00.000Z',
      sets: [
        {index: 1, reps: 5, weight: 20, rir: 0, date: start.toISOString()},
        {index: 2, reps: 5, weight: 20, rir: 0, date: start.toISOString()},
        {index: 3, reps: 6, weight: 22.5, rir: 1, date: start.toISOString()},
      ],
    });
    expect(restored.settings.restTimer.active).toEqual({startedAt: 1000, targetSeconds: 90, exerciseId: 1, setIndex: 2});
  });

  it('a third start reads the incremental layout written by the second', async () => {
    mockMmkv.set('persist:root', legacyRootValue());
    const first = await startApp();
    first.store.dispatch({type: 'START_REST_TIMER', startedAt: 5, targetSeconds: 60, exerciseId: 1, setIndex: 1});
    await first.persistor.flush();

    const second = await startApp();
    const workoutId = baseline.workouts.allIds[baseline.workouts.allIds.length - 1];
    second.store.dispatch({type: 'DELETE_WORKOUT', workout: second.store.getState().workouts.byId[workoutId]});
    await second.persistor.flush();

    const third = await startApp();
    expect(third.store.getState().workouts.byId[workoutId]).toBeUndefined();
    expect(persistedPart(third.store.getState())).toEqual(persistedPart(second.store.getState()));
  });
});
