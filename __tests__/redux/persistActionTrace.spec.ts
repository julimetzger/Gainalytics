import {persistActionTrace} from '../../app/redux/middleware/persistActionTrace';

// GH-288: the trace middleware is dev-only control instrumentation for the
// read-only set-add render-time re-baseline. It must (a) pass every action
// through untouched and (b) log exactly the redux-persist actions plus the
// ADD_OR_UPDATE_SET_IN_WORKOUT cascade trigger, so a logcat capture can
// confirm no persist/* noise leaks into a live set submit.

describe('persistActionTrace middleware', () => {
  const run = (action: unknown) => {
    const next = jest.fn((a) => a);
    const result = persistActionTrace({} as any)(next)(action);
    return {next, result};
  };

  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('passes the action through to next() unchanged', () => {
    const action = {type: 'SOME_UNRELATED_ACTION', payload: 1};
    const {next, result} = run(action);
    expect(next).toHaveBeenCalledWith(action);
    expect(result).toBe(action);
  });

  it('logs a PERSIST_TRACE line for persist/* actions', () => {
    run({type: 'persist/REHYDRATE'});
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/\[PERSIST_TRACE] #\d+ persist\/REHYDRATE @\d+/);
  });

  it('logs a PERSIST_TRACE line for the ADD_OR_UPDATE_SET_IN_WORKOUT cascade trigger', () => {
    run({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'});
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/\[PERSIST_TRACE] #\d+ ADD_OR_UPDATE_SET_IN_WORKOUT @\d+/);
  });

  it('does not log for unrelated actions', () => {
    run({type: 'START_REST_TIMER'});
    run({type: 'UPDATE_RECORD'});
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not throw on malformed actions (no type / non-string type)', () => {
    expect(() => run(undefined)).not.toThrow();
    expect(() => run({})).not.toThrow();
    expect(() => run({type: 123})).not.toThrow();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('increments the running counter across traced actions', () => {
    run({type: 'persist/PERSIST'});
    run({type: 'ADD_OR_UPDATE_SET_IN_WORKOUT'});
    const first = Number(logSpy.mock.calls[0][0].match(/#(\d+)/)[1]);
    const second = Number(logSpy.mock.calls[1][0].match(/#(\d+)/)[1]);
    expect(second).toBe(first + 1);
  });
});
