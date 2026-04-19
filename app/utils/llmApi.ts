/**
 * LLM API abstraction — Phase 1: Anthropic Claude only.
 * Calls the Anthropic Messages API directly from the device.
 * No server required; the user supplies their own API key.
 */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 200;

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export type LlmError =
  | {type: 'no_key'}
  | {type: 'invalid_key'}
  | {type: 'rate_limit'}
  | {type: 'network'; message: string}
  | {type: 'api_error'; status: number; message: string};

export type LlmResult =
  | {ok: true; text: string}
  | {ok: false; error: LlmError};

export async function callAnthropicClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  model: string,
): Promise<LlmResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {ok: false, error: {type: 'no_key'}};
  }

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
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{role: 'user', content: userMessage}],
      }),
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
    const text: string = data?.content?.[0]?.text ?? '';
    return {ok: true, text};
  } catch (e: any) {
    return {ok: false, error: {type: 'network', message: e?.message ?? 'Network error'}};
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
