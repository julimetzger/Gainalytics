/**
 * GH-504 — everything that can go wrong with a ChatGPT-plan request, and the message the
 * user sees for it. Codes and recovery follow
 * https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery.
 */

export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';

export type ChatGptFailure =
  /** No ChatGPT sign-in stored. */
  | {kind: 'not_signed_in'}
  /** The sign-in can no longer be refreshed; tokens were cleared. */
  | {kind: 'reauth_required'}
  /** Signed in, but plan usage (scope chatgpt.tokens.use.direct) was not granted. */
  | {kind: 'plan_usage_missing'}
  /** HTTP 429 subscription_sharing_usage_limit_exceeded. */
  | {kind: 'usage_limit'}
  /** HTTP 503 subscription_sharing_usage_unavailable. */
  | {kind: 'usage_unavailable'}
  /** HTTP 401 even with a freshly refreshed token. */
  | {kind: 'auth_rejected'; message: string}
  | {kind: 'invalid_model'; model: string; message: string}
  | {kind: 'no_model'}
  | {kind: 'timeout'; timeoutMs: number}
  | {kind: 'aborted'}
  | {kind: 'network'; message: string}
  | {kind: 'api_error'; status?: number; code: string; message: string};

export function describeChatGptFailure(failure: ChatGptFailure): string {
  switch (failure.kind) {
    case 'not_signed_in':
      return 'Not signed in to ChatGPT. Sign in under Settings → AI Coach.';
    case 'reauth_required':
      return 'Your ChatGPT sign-in has expired. Sign in again under Settings → AI Coach.';
    case 'plan_usage_missing':
      return 'Gainalytics was not allowed to use your ChatGPT plan. Sign in again under Settings → AI Coach and allow plan usage.';
    case 'usage_limit':
      return 'Your ChatGPT usage limit for Gainalytics is reached. Check your usage in ChatGPT (Settings → Usage) or try again later.';
    case 'usage_unavailable':
      return 'ChatGPT could not check your plan usage right now. Try again in a few minutes.';
    case 'auth_rejected':
      return `ChatGPT did not accept your sign-in (${failure.message}). Sign in again under Settings → AI Coach.`;
    case 'invalid_model':
      return `Invalid model "${failure.model}": ${failure.message} Pick another ChatGPT model in Settings.`;
    case 'no_model':
      return 'Your ChatGPT plan offers no model for Gainalytics right now. Try again later.';
    case 'timeout':
      return `ChatGPT did not answer within ${Math.round(failure.timeoutMs / 1000)}s. Check your connection, or try a faster model in Settings.`;
    case 'aborted':
      return 'Request cancelled.';
    case 'network':
      return `Network error: ${failure.message}`;
    case 'api_error':
      return `ChatGPT error (${failure.status ?? failure.code}): ${failure.message}`;
  }
}

const USAGE_LIMIT_CODE = 'subscription_sharing_usage_limit_exceeded';
const USAGE_UNAVAILABLE_CODE = 'subscription_sharing_usage_unavailable';

/** Maps a non-2xx /v1/responses or /v1/models answer. 401 is handled by the caller (refresh + retry). */
export function classifyHttpError(status: number, body: string, model: string): ChatGptFailure {
  let code = `http_${status}`;
  let message = body.slice(0, 300);
  try {
    const json = JSON.parse(body);
    code = json.error?.code ?? code;
    message = json.error?.message ?? json.detail ?? message;
  } catch {
    // Non-JSON body (e.g. a proxy error page) — keep the excerpt.
  }
  return classifyErrorCode(code, message, status, model);
}

/** Maps an error code from an HTTP error body or a `response.failed` stream event. */
export function classifyErrorCode(
  code: string,
  message: string,
  status: number | undefined,
  model: string,
): ChatGptFailure {
  if (code === USAGE_LIMIT_CODE) return {kind: 'usage_limit'};
  if (code === USAGE_UNAVAILABLE_CODE) return {kind: 'usage_unavailable'};
  if (status === 401) return {kind: 'auth_rejected', message};
  if (code === 'model_not_found' || ((status === 400 || status === 404) && /model/i.test(message))) {
    return {kind: 'invalid_model', model, message};
  }
  return {kind: 'api_error', status, code, message};
}

/** Message for a failed or cancelled "Continue with ChatGPT". */
export function describeSignInError(error: unknown): string {
  const e = error as {name?: string; code?: string; message?: string} | null;
  if (e?.message === 'Sign-in cancelled') return 'Sign-in cancelled.';
  if (e?.code === 'access_denied') return 'Sign-in was declined in the browser.';
  if (e?.code === 'E_LOOPBACK_TIMEOUT') return 'Sign-in timed out. Tap "Continue with ChatGPT" to try again.';
  if (e?.code === 'E_LOOPBACK_START') return 'Sign-in could not start on this device. Try again.';
  if (e?.code === 'invalid_grant') return 'Sign-in expired before it finished. Try again.';
  return `Sign-in failed: ${e?.message ?? String(error)}`;
}
