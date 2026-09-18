import {DEFAULT_LLM_TIMEOUT_MS, withTimeout} from '../../../app/utils/ai/withTimeout';

/** Resolves once the signal has aborted, so the tests never race the timer. */
function onAbort(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    signal.addEventListener('abort', () => resolve());
  });
}

describe('withTimeout', () => {
  it('starts out un-aborted with no cause', () => {
    const handle = withTimeout(10_000);
    expect(handle.signal.aborted).toBe(false);
    expect(handle.getCause()).toBeNull();
    handle.cleanup();
  });

  it('aborts with cause "timeout" once the deadline passes', async () => {
    const handle = withTimeout(20);
    await onAbort(handle.signal);
    expect(handle.signal.aborted).toBe(true);
    expect(handle.getCause()).toBe('timeout');
    handle.cleanup();
  });

  it('aborts with cause "caller" when the caller cancels first', async () => {
    const caller = new AbortController();
    const handle = withTimeout(10_000, caller.signal);
    caller.abort();
    await onAbort(handle.signal);
    expect(handle.getCause()).toBe('caller');
    handle.cleanup();
  });

  it('reports "caller" for a signal that was already aborted before the call', () => {
    const caller = new AbortController();
    caller.abort();
    const handle = withTimeout(10_000, caller.signal);
    expect(handle.signal.aborted).toBe(true);
    expect(handle.getCause()).toBe('caller');
    handle.cleanup();
  });

  it('keeps the first cause when the deadline fires after a caller abort', async () => {
    const caller = new AbortController();
    const handle = withTimeout(10, caller.signal);
    caller.abort();
    await onAbort(handle.signal);
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(handle.getCause()).toBe('caller');
    handle.cleanup();
  });

  it('cleanup stops the timer from ever aborting the signal', async () => {
    const handle = withTimeout(20);
    handle.cleanup();
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(handle.signal.aborted).toBe(false);
    expect(handle.getCause()).toBeNull();
  });

  it('cleanup detaches the caller listener so a later abort is ignored', async () => {
    const caller = new AbortController();
    const handle = withTimeout(10_000, caller.signal);
    handle.cleanup();
    caller.abort();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(handle.signal.aborted).toBe(false);
    expect(handle.getCause()).toBeNull();
  });

  it('defaults to a bound that is generous but finite', () => {
    expect(DEFAULT_LLM_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(Number.isFinite(DEFAULT_LLM_TIMEOUT_MS)).toBe(true);
  });
});
