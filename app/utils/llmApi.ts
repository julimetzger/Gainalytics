/**
 * LLM API abstraction — Phase 1: Anthropic Claude only.
 * Calls the Anthropic Messages API directly from the device.
 * No server required; the user supplies their own API key.
 */

import {withTimeout} from './ai/withTimeout';
import {isTruncatedStopReason, trimToCompleteText} from './ai/truncatedText';
import {extractResponseText} from './ai/extractResponseText';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// GH-449: 200 tokens cut a normal coach insight off mid-word. The insight prompt asks for at
// most two findings in three sentences, which fits comfortably below this cap.
const MAX_TOKENS = 1024;
/**
 * GH-447: the insight is capped at 1024 output tokens, so it has no reason to run long.
 * A shorter bound than the chat's keeps the card from spinning while the user waits on it.
 */
export const INSIGHT_REQUEST_TIMEOUT_MS = 90_000;

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export type LlmError =
  | {type: 'no_key'}
  | {type: 'invalid_key'}
  | {type: 'rate_limit'}
  | {type: 'timeout'; timeoutMs: number}
  | {type: 'aborted'}
  | {type: 'network'; message: string}
  | {type: 'api_error'; status: number; message: string};

export type LlmResult =
  | {ok: true; text: string; truncated: boolean}
  | {ok: false; error: LlmError};

export interface LlmRequestOptions {
  /** Aborts the request when the caller cancels it. */
  signal?: AbortSignal;
  /** Upper bound for the request. Defaults to INSIGHT_REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Output token budget. Defaults to MAX_TOKENS. */
  maxTokens?: number;
}

export async function callAnthropicClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  model: string,
  options: LlmRequestOptions = {},
): Promise<LlmResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {ok: false, error: {type: 'no_key'}};
  }

  const timeoutMs = options.timeoutMs ?? INSIGHT_REQUEST_TIMEOUT_MS;
  const deadline = withTimeout(timeoutMs, options.signal);

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? MAX_TOKENS,
        system: systemPrompt,
        messages: [{role: 'user', content: userMessage}],
      }),
      signal: deadline.signal,
    });

    if (response.status === 401) {
      return {ok: false, error: {type: 'invalid_key'}};
    }
    if (response.status === 429) {
      return {ok: false, error: {type: 'rate_limit'}};
    }
    if (!response.ok) {
      const body = await response.text().catch(() => 'Unknown error');
      return {ok: false, error: {type: 'api_error', status: response.status, message: body}};
    }

    const data = await response.json();
    const rawText = extractResponseText(data);
    const truncated = isTruncatedStopReason(data?.stop_reason);
    return {ok: true, text: truncated ? trimToCompleteText(rawText) : rawText, truncated};
  } catch (e: any) {
    const cause = deadline.getCause();
    if (cause === 'timeout') {
      return {ok: false, error: {type: 'timeout', timeoutMs}};
    }
    if (cause === 'caller') {
      return {ok: false, error: {type: 'aborted'}};
    }
    return {ok: false, error: {type: 'network', message: e?.message ?? 'Network error'}};
  } finally {
    deadline.cleanup();
  }
}

export async function validateAnthropicApiKey(apiKey: string): Promise<LlmResult> {
  return callAnthropicClaude(
    apiKey,
    'You are a helpful assistant.',
    'Reply with exactly: OK',
    DEFAULT_ANTHROPIC_MODEL,
  );
}
