import {createBaseStorage} from '../../app/utils/perf/createBaseStorage';

describe('createBaseStorage (GH-262 async setItem wrapper)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a resolved promise from setItem BEFORE mmkv.set runs', async () => {
    const mmkv = {
      set: jest.fn(),
      getString: jest.fn(),
      delete: jest.fn(),
    };
    const storage = createBaseStorage(mmkv);

    const result = storage.setItem('persist:root', 'payload');

    // mmkv.set must NOT have been called yet — it is deferred to a macrotask.
    expect(mmkv.set).not.toHaveBeenCalled();
    await expect(result).resolves.toBe(true);

    // After the macrotask drains, mmkv.set runs with the same arguments.
    jest.runAllTimers();
    expect(mmkv.set).toHaveBeenCalledTimes(1);
    expect(mmkv.set).toHaveBeenCalledWith('persist:root', 'payload');
  });

  it('getItem reads synchronously and resolves to the MMKV value', async () => {
    const mmkv = {
      set: jest.fn(),
      getString: jest.fn().mockReturnValue('stored'),
      delete: jest.fn(),
    };
    const storage = createBaseStorage(mmkv);

    await expect(storage.getItem('persist:root')).resolves.toBe('stored');
    expect(mmkv.getString).toHaveBeenCalledWith('persist:root');
  });

  it('removeItem deletes synchronously and resolves', async () => {
    const mmkv = {
      set: jest.fn(),
      getString: jest.fn(),
      delete: jest.fn(),
    };
    const storage = createBaseStorage(mmkv);

    await expect(storage.removeItem('persist:root')).resolves.toBeUndefined();
    expect(mmkv.delete).toHaveBeenCalledWith('persist:root');
  });

  it('queues multiple setItem calls in submission order', async () => {
    const mmkv = {
      set: jest.fn(),
      getString: jest.fn(),
      delete: jest.fn(),
    };
    const storage = createBaseStorage(mmkv);

    storage.setItem('persist:root', 'a');
    storage.setItem('persist:root', 'b');
    storage.setItem('persist:root', 'c');

    expect(mmkv.set).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(mmkv.set.mock.calls).toEqual([
      ['persist:root', 'a'],
      ['persist:root', 'b'],
      ['persist:root', 'c'],
    ]);
  });
});
