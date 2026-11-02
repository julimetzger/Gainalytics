/**
 * GH-671: incremental redux-persist storage.
 *
 * redux-persist (v6) re-serialised the whole persisted state into ONE value on every change: the
 * `workouts` slice (~1.35 MB with a real training history) was stringified, the slice strings were
 * stringified a second time into the root value (~1.77 MB) and that value was written to MMKV —
 * on every logged set, on the JS thread, right after the tap.
 *
 * This storage is used with `serialize: false` / `deserialize: false`, so it receives the staged
 * state as objects and writes only what changed:
 * - every slice is its own part, written when its reference changes (redux-persist's own rule);
 * - `workouts.byId` is split into chunks of WORKOUT_CHUNK_SIZE ids. A chunk is rewritten when one of
 *   its workouts is a different object than the one written last (compared against a private map,
 *   never against the previous Redux state, which some reducers mutate) or was removed;
 * - the other `workouts` fields (allIds, byExerciseId, plannedWorkouts) are small and rewritten
 *   whenever `workouts` changes.
 *
 * Crash safety: parts are written copy-on-write under keys that carry a new generation number, and
 * only then the manifest (one key) is replaced — that single write is the commit. A process killed
 * before it leaves the previous manifest pointing at the previous, complete set of parts; the
 * orphaned new parts are removed on the next start. Superseded parts are deleted after the commit.
 *
 * Migration: without a manifest the legacy single value (`persist:root`) is read as before. The
 * first write then stores every part plus the manifest and only afterwards removes the legacy key.
 */

/** The subset of the MMKV API this storage needs (an in-memory map in tests). */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): unknown;
  getAllKeys(): string[];
}

type StagedState = Record<string, unknown>;

interface Manifest {
  v: 1;
  gen: number;
  /** part name → storage key holding it */
  parts: Record<string, string>;
}

export const WORKOUT_CHUNK_SIZE = 100;
const WORKOUTS = 'workouts';
const SLICE_PREFIX = 's:';
const WORKOUT_FIELD_PREFIX = 'w:';
const WORKOUT_CHUNK_PREFIX = 'w:byId:';

const chunkOf = (id: string) => {
  const numeric = Number(id);
  return Number.isFinite(numeric) ? String(Math.floor(numeric / WORKOUT_CHUNK_SIZE)) : 'x';
};

const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const manifestKeyOf = (key: string) => `${key}:manifest`;

export const createIncrementalStorage = (store: KeyValueStore) => {
  // What is on disk, per persist key: the manifest and the references written last.
  const manifests = new Map<string, Manifest>();
  const writtenSlices = new Map<string, Map<string, unknown>>();
  const writtenWorkouts = new Map<string, Map<string, unknown>>();
  const legacyPending = new Set<string>();

  const slicesOf = (key: string) => writtenSlices.get(key) ?? writtenSlices.set(key, new Map()).get(key)!;
  const workoutsOf = (key: string) => writtenWorkouts.get(key) ?? writtenWorkouts.set(key, new Map()).get(key)!;

  const readLegacy = (key: string): StagedState | undefined => {
    const serialized = store.getString(key);
    if (!serialized) return undefined;
    const raw = JSON.parse(serialized) as Record<string, string>;
    const state: StagedState = {};
    Object.keys(raw).forEach((slice) => {
      state[slice] = JSON.parse(raw[slice]);
    });
    legacyPending.add(key);
    return state;
  };

  const getItem = (key: string): Promise<StagedState | undefined> => {
    const manifestValue = store.getString(manifestKeyOf(key));
    if (manifestValue === undefined) {
      return Promise.resolve(readLegacy(key));
    }
    const manifest = JSON.parse(manifestValue) as Manifest;
    const state: StagedState = {};
    const slices = slicesOf(key);
    const workoutsById = workoutsOf(key);
    let workouts: Record<string, any> | undefined;
    const byId: Record<string, unknown> = {};
    Object.entries(manifest.parts).forEach(([part, storageKey]) => {
      const serialized = store.getString(storageKey);
      if (serialized === undefined) {
        // Never written that way by this storage; keep everything else rather than nothing.
        console.warn(`incremental-storage: part ${part} is missing`);
        return;
      }
      const value = JSON.parse(serialized);
      if (part.startsWith(WORKOUT_CHUNK_PREFIX)) {
        workouts = workouts ?? {};
        Object.assign(byId, value);
      } else if (part.startsWith(WORKOUT_FIELD_PREFIX)) {
        workouts = workouts ?? {};
        workouts[part.slice(WORKOUT_FIELD_PREFIX.length)] = value;
      } else if (part.startsWith(SLICE_PREFIX)) {
        const slice = part.slice(SLICE_PREFIX.length);
        state[slice] = value;
        slices.set(slice, value);
      }
    });
    if (workouts !== undefined) {
      workouts.byId = byId;
      state[WORKOUTS] = workouts;
      slices.set(WORKOUTS, workouts);
      Object.keys(byId).forEach((id) => workoutsById.set(id, byId[id]));
    }
    manifests.set(key, manifest);
    // Parts of a write that never reached its manifest, and the legacy value once migrated.
    const referenced = new Set(Object.values(manifest.parts));
    store.getAllKeys().forEach((storedKey) => {
      if ((storedKey === key || storedKey.startsWith(`${key}:`)) && storedKey !== manifestKeyOf(key) && !referenced.has(storedKey)) {
        store.remove(storedKey);
      }
    });
    return Promise.resolve(state);
  };

  /** Parts of the workouts slice to (re)write and the chunk parts that became empty. */
  const diffWorkouts = (key: string, workouts: Record<string, any>, previousParts: Record<string, string>) => {
    const writes: [string, unknown][] = [];
    const removals: string[] = [];
    const {byId, ...fields} = workouts;
    Object.keys(fields).forEach((field) => {
      if (fields[field] !== undefined) writes.push([WORKOUT_FIELD_PREFIX + field, fields[field]]);
    });
    Object.keys(previousParts).forEach((part) => {
      if (part.startsWith(WORKOUT_FIELD_PREFIX) && !part.startsWith(WORKOUT_CHUNK_PREFIX) && fields[part.slice(WORKOUT_FIELD_PREFIX.length)] === undefined) {
        removals.push(part);
      }
    });
    const written = workoutsOf(key);
    const current: Record<string, unknown> = isRecord(byId) ? byId : {};
    const dirty = new Set<string>();
    for (const id in current) {
      if (written.get(id) !== current[id]) dirty.add(chunkOf(id));
    }
    written.forEach((_workout, id) => {
      if (!(id in current)) dirty.add(chunkOf(id));
    });
    if (dirty.size === 0) return {writes, removals};
    const chunks = new Map<string, Record<string, unknown>>();
    dirty.forEach((chunk) => chunks.set(chunk, {}));
    written.forEach((_workout, id) => {
      if (dirty.has(chunkOf(id))) written.delete(id);
    });
    for (const id in current) {
      const chunk = chunks.get(chunkOf(id));
      if (chunk !== undefined) {
        chunk[id] = current[id];
        written.set(id, current[id]);
      }
    }
    chunks.forEach((chunk, name) => {
      if (Object.keys(chunk).length > 0) writes.push([WORKOUT_CHUNK_PREFIX + name, chunk]);
      else if (previousParts[WORKOUT_CHUNK_PREFIX + name] !== undefined) removals.push(WORKOUT_CHUNK_PREFIX + name);
    });
    return {writes, removals};
  };

  const writeItem = (key: string, staged: StagedState): void => {
    const previous = manifests.get(key);
    const previousParts = previous?.parts ?? {};
    const slices = slicesOf(key);
    const writes: [string, unknown][] = [];
    const removals: string[] = [];

    Object.keys(staged).forEach((slice) => {
      const value = staged[slice];
      if (value === undefined) return;
      if (slice === WORKOUTS && isRecord(value)) {
        if (slices.get(slice) === value && previous !== undefined) return;
        const diff = diffWorkouts(key, value, previousParts);
        writes.push(...diff.writes);
        removals.push(...diff.removals);
      } else if (slices.get(slice) !== value || previousParts[SLICE_PREFIX + slice] === undefined) {
        writes.push([SLICE_PREFIX + slice, value]);
      }
      slices.set(slice, value);
    });
    // Slices redux-persist no longer stages (removed from the state) leave the manifest.
    Object.keys(previousParts).forEach((part) => {
      if (part.startsWith(SLICE_PREFIX) && staged[part.slice(SLICE_PREFIX.length)] === undefined) removals.push(part);
    });
    if (staged[WORKOUTS] === undefined) {
      Object.keys(previousParts).forEach((part) => {
        if (part.startsWith(WORKOUT_FIELD_PREFIX)) removals.push(part);
      });
      writtenWorkouts.delete(key);
    }
    if (writes.length === 0 && removals.length === 0 && previous !== undefined) return;

    const gen = (previous?.gen ?? 0) + 1;
    const parts = {...previousParts};
    const superseded: string[] = [];
    writes.forEach(([part, value]) => {
      const storageKey = `${key}:${part}:${gen}`;
      store.set(storageKey, JSON.stringify(value));
      if (parts[part] !== undefined) superseded.push(parts[part]);
      parts[part] = storageKey;
    });
    removals.forEach((part) => {
      if (parts[part] !== undefined) superseded.push(parts[part]);
      delete parts[part];
    });
    const manifest: Manifest = {v: 1, gen, parts};
    // The commit: until this write the previous manifest and its parts stay intact.
    store.set(manifestKeyOf(key), JSON.stringify(manifest));
    manifests.set(key, manifest);
    superseded.forEach((storageKey) => store.remove(storageKey));
    if (legacyPending.delete(key)) store.remove(key);
  };

  const setItem = (key: string, staged: StagedState): Promise<void> => {
    // The reference caches are updated while the write is prepared. If a part or the manifest write
    // throws, the previous manifest is still the committed one, so the caches go back to what it holds;
    // otherwise later writes would treat the failed snapshot as saved and skip it.
    const slicesBefore = new Map(slicesOf(key));
    const workoutsBefore = writtenWorkouts.has(key) ? new Map(workoutsOf(key)) : undefined;
    try {
      writeItem(key, staged);
      return Promise.resolve();
    } catch (error) {
      writtenSlices.set(key, slicesBefore);
      if (workoutsBefore === undefined) writtenWorkouts.delete(key);
      else writtenWorkouts.set(key, workoutsBefore);
      return Promise.reject(error);
    }
  };

  const removeItem = (key: string): Promise<void> => {
    store.getAllKeys().forEach((storedKey) => {
      if (storedKey === key || storedKey.startsWith(`${key}:`)) store.remove(storedKey);
    });
    manifests.delete(key);
    writtenSlices.delete(key);
    writtenWorkouts.delete(key);
    legacyPending.delete(key);
    return Promise.resolve();
  };

  return {getItem, setItem, removeItem};
};
