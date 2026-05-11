import {configureStore} from '@reduxjs/toolkit';
import type {Persistor} from 'redux-persist';
import {
  HOT_ACTION_TYPES,
  FLUSH_ON_ACTION_TYPES,
  attachPersistorForHotActionSkip,
  detachPersistorForHotActionSkip,
  flushHotActionState,
  skipPersistOnHotActions,
} from '../../../app/redux/middleware/skipPersistOnHotActions';
import {
  createBaseStorage,
  isForceSyncWritesEnabled,
  setForceSyncWrites,
} from '../../../app/utils/perf/createBaseStorage';

function makeFakePersistor() {
  const calls: string[] = [];
  const persistor = {
    pause: jest.fn(() => {
      calls.push('pause');
    }),
    persist: jest.fn(() => {
      calls.push('persist');
    }),
    flush: jest.fn(() => {
      calls.push('flush');
      return Promise.resolve([]);
    }),
    purge: jest.fn(() => Promise.resolve([])),
    getState: jest.fn(),
    subscribe: jest.fn(),
    dispatch: jest.fn(),
  } as unknown as Persistor;
  return {persistor, calls};
}

function makeStoreWithMiddleware(p?: Persistor, persistKey: string = 'root') {
  // Count user actions only; ignore internal redux-persist actions AND the
  // configureStore '@@INIT' so reducer state reflects only the test's dispatches.
  const reducer = (
    state: {count: number; last: string | null; dispatched: string[]} = {
      count: 0,
      last: null,
      dispatched: [],
    },
    action: any,
  ) => {
    if (typeof action?.type !== 'string') return state;
    if (action.type.startsWith('@@')) return state;
    return {
      count: state.count + 1,
      last: action.type,
      dispatched: [...state.dispatched, action.type],
    };
  };
  const store = configureStore({
    reducer,
    middleware: (gdm) =>
      gdm({serializableCheck: false, immutableCheck: false}).concat(
        skipPersistOnHotActions,
      ),
  });
  if (p) attachPersistorForHotActionSkip(p, store as any, persistKey);
  else detachPersistorForHotActionSkip();
  return store;
}

describe('skipPersistOnHotActions middleware', () => {
  afterEach(() => {
    detachPersistorForHotActionSkip();
  });

  it('enumerates the documented hot-action whitelist', () => {
    // Confirms the cascade discovered by grep in dispatchAddOrUpdateSetInWorkout
    // + dispatchRestTimer. Adding a new hot action requires updating this set
    // and the test together so unknown writes never silently start skipping.
    expect(Array.from(HOT_ACTION_TYPES).sort()).toEqual([
      'ADD_OR_UPDATE_SET_IN_WORKOUT',
      'ADD_RECORD',
      'DELETE_RECORD',
      'START_REST_TIMER',
      'UPDATE_RECORD',
    ]);
  });

  it('FLUSH_ON_ACTION_TYPES contains FINALIZE_WORKOUT', () => {
    expect(FLUSH_ON_ACTION_TYPES.has('FINALIZE_WORKOUT')).toBe(true);
  });

  it('pauses then resumes the persistor around every hot action, in order', () => {
    const {persistor, calls} = makeFakePersistor();
    const store = makeStoreWithMiddleware(persistor);

    store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'} as any);
    expect(calls).toEqual(['pause', 'persist']);
    expect((persistor.flush as jest.Mock)).not.toHaveBeenCalled();

    store.dispatch({type: 'START_REST_TIMER'} as any);
    store.dispatch({type: 'UPDATE_RECORD'} as any);
    store.dispatch({type: 'ADD_RECORD'} as any);
    store.dispatch({type: 'DELETE_RECORD'} as any);

    expect(calls).toEqual([
      'pause', 'persist',
      'pause', 'persist',
      'pause', 'persist',
      'pause', 'persist',
      'pause', 'persist',
    ]);
  });

  it('lets the reducer run for hot actions (state still changes)', () => {
    const {persistor} = makeFakePersistor();
    const store = makeStoreWithMiddleware(persistor);
    store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'} as any);
    expect((store.getState() as any).last).toBe('ADD_OR_UPDATE_SET_IN_WORKOUT');
  });

  it('does not touch the persistor for cold actions', () => {
    const {persistor} = makeFakePersistor();
    const store = makeStoreWithMiddleware(persistor);
    store.dispatch({type: 'ADD_WORKOUT'} as any);
    store.dispatch({type: 'DELETE_WORKOUT'} as any);
    store.dispatch({type: 'REPLACE_WORKOUT_SETS'} as any);
    store.dispatch({type: 'DELETE_SET_FROM_WORKOUT'} as any);
    store.dispatch({type: 'SET_PALETTE'} as any);
    expect(persistor.pause).not.toHaveBeenCalled();
    expect(persistor.persist).not.toHaveBeenCalled();
    expect(persistor.flush).not.toHaveBeenCalled();
  });

  it('dispatches REHYDRATE + flushes on FINALIZE_WORKOUT after the reducer runs', () => {
    const {persistor, calls} = makeFakePersistor();
    const store = makeStoreWithMiddleware(persistor, 'root');
    store.dispatch({type: 'FINALIZE_WORKOUT'} as any);
    // REHYDRATE was dispatched before flush so the persistor's lastState
    // resync runs ahead of the queue drain.
    const dispatched = (store.getState() as any).dispatched;
    expect(dispatched[0]).toBe('FINALIZE_WORKOUT');
    expect(dispatched[1]).toBe('persist/REHYDRATE');
    expect(calls).toEqual(['flush']);
    expect(persistor.pause).not.toHaveBeenCalled();
    expect(persistor.persist).not.toHaveBeenCalled();
  });

  it('routes internal redux-persist actions straight through without touching the persistor', () => {
    const {persistor} = makeFakePersistor();
    const store = makeStoreWithMiddleware(persistor);
    store.dispatch({type: 'persist/PAUSE'} as any);
    store.dispatch({type: 'persist/PERSIST', register: () => {}, rehydrate: () => {}} as any);
    store.dispatch({type: 'persist/REHYDRATE', payload: undefined, key: 'root'} as any);
    store.dispatch({type: 'persist/FLUSH', result: () => {}} as any);
    expect(persistor.pause).not.toHaveBeenCalled();
    expect(persistor.persist).not.toHaveBeenCalled();
    expect(persistor.flush).not.toHaveBeenCalled();
  });

  it('does nothing special when no persistor is attached (pre-bootstrap)', () => {
    const {persistor} = makeFakePersistor();
    const store = makeStoreWithMiddleware(); // detached
    store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'} as any);
    store.dispatch({type: 'FINALIZE_WORKOUT'} as any);
    expect(persistor.pause).not.toHaveBeenCalled();
    expect(persistor.persist).not.toHaveBeenCalled();
    expect(persistor.flush).not.toHaveBeenCalled();
    expect((store.getState() as any).count).toBe(2);
  });

  it('still resumes the persistor if the reducer throws (try/finally)', () => {
    const {persistor, calls} = makeFakePersistor();
    const reducer = (_state: any, action: any) => {
      if (action.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT') throw new Error('boom');
      return _state ?? {};
    };
    const store = configureStore({
      reducer,
      middleware: (gdm) =>
        gdm({serializableCheck: false}).concat(skipPersistOnHotActions),
    });
    attachPersistorForHotActionSkip(persistor, store as any, 'root');
    expect(() =>
      store.dispatch({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'} as any),
    ).toThrow('boom');
    // pause was called, and persist must still have been called via the finally block.
    expect(calls).toEqual(['pause', 'persist']);
  });

  it('passes through actions whose type is not a string without touching the persistor', () => {
    // Redux's dev-mode dispatch forbids non-string `type`, so bypass the store
    // and call the middleware directly. The middleware must short-circuit
    // before HOT_ACTION_TYPES.has(...) is reached so a malformed action never
    // pauses or flushes the persistor.
    const {persistor} = makeFakePersistor();
    const dummyStore = {
      dispatch: jest.fn(),
      getState: jest.fn(),
      subscribe: jest.fn(),
      replaceReducer: jest.fn(),
    } as any;
    attachPersistorForHotActionSkip(persistor, dummyStore, 'root');
    const captured: unknown[] = [];
    const dispatch = (a: unknown) => {
      captured.push(a);
      return a;
    };
    const wrapped = (skipPersistOnHotActions as any)({})(dispatch);
    wrapped({type: 123});
    wrapped({type: undefined});
    wrapped(null);
    expect(captured).toHaveLength(3);
    expect(persistor.pause).not.toHaveBeenCalled();
    expect(persistor.persist).not.toHaveBeenCalled();
    expect(persistor.flush).not.toHaveBeenCalled();
  });

  describe('createBaseStorage sync-write mode', () => {
    afterEach(() => {
      setForceSyncWrites(false);
    });

    it('defaults to setTimeout-deferred writes', () => {
      jest.useFakeTimers();
      const set = jest.fn();
      const mmkv = {set, getString: jest.fn(), delete: jest.fn()};
      const storage = createBaseStorage(mmkv);
      void storage.setItem('persist:root', 'payload');
      expect(set).not.toHaveBeenCalled();   // deferred
      jest.runAllTimers();
      expect(set).toHaveBeenCalledWith('persist:root', 'payload');
      jest.useRealTimers();
    });

    it('writes synchronously when sync mode is enabled', () => {
      const set = jest.fn();
      const mmkv = {set, getString: jest.fn(), delete: jest.fn()};
      const storage = createBaseStorage(mmkv);
      setForceSyncWrites(true);
      void storage.setItem('persist:root', 'payload');
      expect(set).toHaveBeenCalledWith('persist:root', 'payload');
      expect(isForceSyncWritesEnabled()).toBe(true);
    });

    it('flushHotActionState toggles sync mode for the duration of the flush only', async () => {
      const {persistor} = makeFakePersistor();
      const store = makeStoreWithMiddleware(persistor, 'root');
      const observed: boolean[] = [];
      (persistor.flush as jest.Mock).mockImplementationOnce(() => {
        observed.push(isForceSyncWritesEnabled());
        return Promise.resolve([]);
      });
      expect(isForceSyncWritesEnabled()).toBe(false);
      await flushHotActionState();
      // sync mode was on during the flush call
      expect(observed).toEqual([true]);
      // and restored to off afterwards
      expect(isForceSyncWritesEnabled()).toBe(false);
      // (keep `store` referenced so TS doesn't complain about unused var)
      expect((store.getState() as any).dispatched).toEqual(['persist/REHYDRATE']);
    });
  });

  describe('flushHotActionState', () => {
    it('is a no-op when no persistor is attached', async () => {
      detachPersistorForHotActionSkip();
      await expect(flushHotActionState()).resolves.toBeUndefined();
    });

    it('dispatches REHYDRATE on the attached store, then calls persistor.flush', async () => {
      const {persistor, calls} = makeFakePersistor();
      const store = makeStoreWithMiddleware(persistor, 'root');
      await flushHotActionState();
      // The REHYDRATE dispatch goes through the same middleware chain and
      // reaches the reducer's `dispatched` log.
      expect((store.getState() as any).dispatched).toEqual(['persist/REHYDRATE']);
      // Order matters: dispatch must happen BEFORE flush so the resync queues
      // the slices the flush will then write.
      expect(calls).toEqual(['flush']);
    });

    it('uses the persist key supplied at attach time', async () => {
      const {persistor} = makeFakePersistor();
      const dispatchSpy = jest.fn();
      attachPersistorForHotActionSkip(
        persistor,
        {dispatch: dispatchSpy, getState: jest.fn(), subscribe: jest.fn(), replaceReducer: jest.fn()} as any,
        'custom-key',
      );
      await flushHotActionState();
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({type: 'persist/REHYDRATE', key: 'custom-key', payload: undefined}),
      );
    });
  });
});
