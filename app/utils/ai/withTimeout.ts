/**
 * GH-447: bounds every Anthropic request in time and makes it cancellable.
 *
 * React Native's Android networking stack (OkHttp via RN's OkHttpClientProvider) is configured
 * with no read timeout at all, so a request that stalls never settles its promise. Without an
 * upper bound the UI sits in `isLoading` forever — no text, no error, nothing to cancel.
 * A larger model simply makes the stall window big enough to hit in normal use.
 */

/** Who aborted the request — the deadline, or the caller (user pressed Stop). */
export type AbortCause = 'timeout' | 'caller';

export interface TimeoutHandle {
  /** Pass this to `fetch`. */
  signal: AbortSignal;
  /** The cause of the abort, or null while the request is still allowed to run. */
  getCause: () => AbortCause | null;
  /** Always call this once the request settled, so the timer cannot outlive it. */
  cleanup: () => void;
}

/**
 * Builds a signal that aborts either when `timeoutMs` elapses or when `callerSignal` aborts,
 * and remembers which of the two fired so the caller can tell a cancel from a timeout.
 */
export function withTimeout(timeoutMs: number, callerSignal?: AbortSignal): TimeoutHandle {
  const controller = new AbortController();
  let cause: AbortCause | null = null;

  const abortWith = (next: AbortCause) => {
    if (cause !== null) return;
    cause = next;
    controller.abort();
  };

  const timer = setTimeout(() => abortWith('timeout'), timeoutMs);
  const onCallerAbort = () => abortWith('caller');

  if (callerSignal) {
    if (callerSignal.aborted) {
      onCallerAbort();
    } else {
      callerSignal.addEventListener('abort', onCallerAbort);
    }
  }

  return {
    signal: controller.signal,
    getCause: () => cause,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    },
  };
}
