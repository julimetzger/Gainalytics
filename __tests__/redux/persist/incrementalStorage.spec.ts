import {createIncrementalStorage, KeyValueStore, manifestKeyOf, WORKOUT_CHUNK_SIZE} from '../../../app/redux/persist/incremental-storage';

const KEY = 'persist:root';

const memoryStore = () => {
  const map = new Map<string, string>();
  const writes: string[] = [];
  const store: KeyValueStore & {map: Map<string, string>; writes: string[]} = {
    map,
    writes,
    getString: (key) => map.get(key),
    set: (key, value) => {
      writes.push(key);
      map.set(key, value);
    },
    remove: (key) => map.delete(key),
    getAllKeys: () => [...map.keys()],
  };
  return store;
};

const workout = (id: number, reps = 5) => ({id, exerciseId: 1, sets: [{index: 1, reps, weight: 20, rir: 0}], notes: ''});

/** A staged state as redux-persist hands it over with `serialize: false` (workouts already filtered). */
const stagedState = (workoutIds: number[]) => {
  const byId: Record<number, unknown> = {};
  workoutIds.forEach((id) => (byId[id] = workout(id)));
  return {
    settings: {palette: 'blue', restTimer: {}},
    trainings: {byId: {1: {id: 1, doneWorkoutIds: {1: workoutIds[0]}}}, allIds: [1]},
    workouts: {byId, allIds: workoutIds, byExerciseId: {1: workoutIds}, plannedWorkouts: []},
    _persist: {version: 14, rehydrated: true},
  } as Record<string, any>;
};

/** What redux-persist v6 wrote before GH-671: one value, every slice JSON-encoded a second time. */
const legacyValue = (state: Record<string, unknown>) => {
  const raw: Record<string, string> = {};
  Object.keys(state).forEach((slice) => (raw[slice] = JSON.stringify(state[slice])));
  return JSON.stringify(raw);
};

const ids = (from: number, count: number) => Array.from({length: count}, (_value, i) => from + i);

describe('incremental redux-persist storage (GH-671)', () => {
  it('reads the legacy single value, migrates it on the first write and removes the legacy key only after the manifest', async () => {
    const store = memoryStore();
    const state = stagedState(ids(1, 250));
    store.set(KEY, legacyValue(state));
    store.writes.length = 0;

    const storage = createIncrementalStorage(store);
    const loaded = await storage.getItem(KEY);
    expect(loaded).toEqual(state);

    await storage.setItem(KEY, loaded!);

    expect(store.map.has(KEY)).toBe(false);
    expect(store.writes[store.writes.length - 1]).toBe(manifestKeyOf(KEY));
    // A fresh process reads the new layout back to the same state.
    expect(await createIncrementalStorage(store).getItem(KEY)).toEqual(state);
  });

  it('writes only the chunk of a changed workout, the small workout fields and the changed slice', async () => {
    const store = memoryStore();
    const storage = createIncrementalStorage(store);
    const state = stagedState(ids(1, 5 * WORKOUT_CHUNK_SIZE));
    await storage.setItem(KEY, state);
    store.writes.length = 0;

    // One logged set: a new object for workout 250, the rest timer starts.
    const next = {
      ...state,
      settings: {...state.settings, restTimer: {active: {startedAt: 1, targetSeconds: 90}}},
      workouts: {...state.workouts, byId: {...state.workouts.byId, 250: workout(250, 8)}},
    };
    await storage.setItem(KEY, next);

    expect(store.writes.map((key) => key.replace(/:\d+$/, ''))).toEqual([
      `${KEY}:s:settings`,
      `${KEY}:w:allIds`,
      `${KEY}:w:byExerciseId`,
      `${KEY}:w:plannedWorkouts`,
      `${KEY}:w:byId:2`,
      manifestKeyOf(KEY),
    ]);
    expect(await createIncrementalStorage(store).getItem(KEY)).toEqual(next);
    // Superseded parts are gone: one key per part plus the manifest.
    expect(store.map.size).toBe(Object.keys(JSON.parse(store.map.get(manifestKeyOf(KEY))!).parts).length + 1);
  });

  it('notices a workout added to or removed from the previous byId object itself (reducers that mutate it)', async () => {
    const store = memoryStore();
    const storage = createIncrementalStorage(store);
    const state = stagedState([1, 2, 150]);
    await storage.setItem(KEY, state);

    // ADD_WORKOUT writes the new id into the old byId before copying it (addNewWorkoutToState).
    const byId = state.workouts.byId;
    byId[3] = workout(3);
    delete byId[150];
    await storage.setItem(KEY, {...state, workouts: {...state.workouts, byId: {...byId}, allIds: [1, 2, 3]}});

    const reloaded = await createIncrementalStorage(store).getItem(KEY);
    expect(reloaded!.workouts).toEqual({byId: {1: workout(1), 2: workout(2), 3: workout(3)}, allIds: [1, 2, 3], byExerciseId: {1: [1, 2, 150]}, plannedWorkouts: []});
    // The chunk of 150 became empty and left the manifest.
    expect(Object.keys(JSON.parse(store.map.get(manifestKeyOf(KEY))!).parts)).not.toContain('w:byId:1');
  });

  it('keeps the previous complete state when the process dies before the manifest is written', async () => {
    const store = memoryStore();
    const state = stagedState(ids(1, 300));
    await createIncrementalStorage(store).setItem(KEY, state);

    const dying = createIncrementalStorage(store);
    await dying.getItem(KEY);
    const originalSet = store.set;
    store.set = (key, value) => {
      if (key === manifestKeyOf(KEY)) throw new Error('killed');
      originalSet(key, value);
    };
    const next = {...state, workouts: {...state.workouts, byId: {...state.workouts.byId, 7: workout(7, 12)}, allIds: [...state.workouts.allIds]}};
    await expect(dying.setItem(KEY, next)).rejects.toThrow('killed');
    store.set = originalSet;
    const keysAfterCrash = store.map.size;

    const restarted = createIncrementalStorage(store);
    expect(await restarted.getItem(KEY)).toEqual(state);
    // The orphaned parts of the interrupted write were cleaned up on start.
    expect(store.map.size).toBeLessThan(keysAfterCrash);
    expect([...store.map.keys()].every((key) => key === manifestKeyOf(KEY) || Object.values(JSON.parse(store.map.get(manifestKeyOf(KEY))!).parts).includes(key))).toBe(true);
  });

  it('a failed write is not taken as saved: the next write still persists the changes it carried', async () => {
    const store = memoryStore();
    const storage = createIncrementalStorage(store);
    const state = stagedState([1, 2]);
    await storage.setItem(KEY, state);

    const changedWorkout = {...state.workouts.byId[2], notes: 'changed'};
    const next = {
      ...state,
      settings: {...state.settings, palette: 'red'},
      workouts: {...state.workouts, byId: {...state.workouts.byId, 2: changedWorkout}},
    };
    const set = store.set;
    store.set = (key, value) => {
      if (key === manifestKeyOf(KEY)) throw new Error('storage full');
      set(key, value);
    };
    await expect(storage.setItem(KEY, next)).rejects.toThrow('storage full');
    store.set = set;

    // A later write of an unrelated change must still carry the failed snapshot's settings and workout.
    const later = {...next, trainings: {...state.trainings, allIds: [1]}};
    await storage.setItem(KEY, later);

    expect(await createIncrementalStorage(store).getItem(KEY)).toEqual(later);
  });

  it('writes nothing when no persisted slice changed', async () => {
    const store = memoryStore();
    const storage = createIncrementalStorage(store);
    const state = stagedState([1, 2]);
    await storage.setItem(KEY, state);
    store.writes.length = 0;

    await storage.setItem(KEY, {...state});

    expect(store.writes).toEqual([]);
  });

  it('removes every key of the persist key on purge', async () => {
    const store = memoryStore();
    const storage = createIncrementalStorage(store);
    await storage.setItem(KEY, stagedState([1, 2]));
    store.set('other', 'kept');

    await storage.removeItem(KEY);

    expect([...store.map.keys()]).toEqual(['other']);
    expect(await createIncrementalStorage(store).getItem(KEY)).toBeUndefined();
  });
});
