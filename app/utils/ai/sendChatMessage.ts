/**
 * Chat API wrapper — sends a full conversation history to Anthropic /v1/messages.
 * Full history is intentional: no truncation, costs grow linearly with conversation length.
 * TODO(cost-warning): consider token limits / summary rollup in a future ticket.
 */

import {DEFAULT_ANTHROPIC_MODEL} from '../llmApi';
import {DEFAULT_LLM_TIMEOUT_MS, withTimeout} from './withTimeout';
import {TRUNCATION_NOTICE, isTruncatedStopReason, trimToCompleteText} from './truncatedText';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// GH-376: 1024 truncated typical multi-paragraph coaching answers mid-sentence.
const CHAT_MAX_TOKENS = 4096;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** UI-only: true if training context JSON was attached on this assistant reply. Stripped before API call. */
  hadContext?: boolean;
}

/**
 * GH-447: the chat has to react differently to a user cancel than to a failure, so the
 * failure carries its kind rather than only a message.
 */
export type SendChatFailureKind = 'no_key' | 'aborted' | 'timeout' | 'error';

export type SendChatResult =
  | {ok: true; text: string; hadContext: boolean; truncated: boolean}
  | {ok: false; kind: SendChatFailureKind; error: string};

export interface SendChatOptions {
  /** Aborts the request when the user presses Stop. */
  signal?: AbortSignal;
  /** Upper bound for the request. Defaults to DEFAULT_LLM_TIMEOUT_MS. */
  timeoutMs?: number;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  systemPrompt?: string,
  model: string = DEFAULT_ANTHROPIC_MODEL,
  options: SendChatOptions = {},
): Promise<SendChatResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {ok: false, kind: 'no_key', error: 'No API key configured.'};
  }

  const hadContext = Boolean(systemPrompt && systemPrompt.includes('Analysis context'));
  // Strip UI-only fields before sending to the API
  const apiMessages = messages.map(({role, content}) => ({role, content}));

  console.log(
    `[sendChatMessage] context_in_request=${hadContext} system_len=${systemPrompt?.length ?? 0} msg_count=${apiMessages.length}`,
  );

  const timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const deadline = withTimeout(timeoutMs, options.signal);

  try {
    const bodyPayload: Record<string, unknown> = {
      model,
      max_tokens: CHAT_MAX_TOKENS,
      messages: apiMessages,
    };
    if (systemPrompt) {
      bodyPayload.system = systemPrompt;
    }

    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(bodyPayload),
      signal: deadline.signal,
    });

    if (response.status === 401) {
      return {ok: false, kind: 'error', error: 'Invalid API key. Check your settings.'};
    }
    if (response.status === 429) {
      return {ok: false, kind: 'error', error: 'API rate limit reached. Try again later.'};
    }
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      const invalidModelMessage = extractInvalidModelMessage(response.status, errorBody);
      if (invalidModelMessage) {
        return {
          ok: false,
          kind: 'error',
          error: `Invalid model "${model}": ${invalidModelMessage} Check the Claude Model field in Settings.`,
        };
      }
      return {ok: false, kind: 'error', error: `API error (${response.status}): ${errorBody}`};
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text ?? '';
    // GH-376/GH-449: if the model hit the token cap, end on a complete sentence and say so
    // instead of silently breaking off mid-word with no indication anything is missing.
    const truncated = isTruncatedStopReason(data?.stop_reason);
    const text = truncated
      ? `${trimToCompleteText(rawText)}\n\n_(${TRUNCATION_NOTICE})_`
      : rawText;
    return {ok: true, text, hadContext, truncated};
  } catch (e: any) {
    const cause = deadline.getCause();
    if (cause === 'caller') {
      return {ok: false, kind: 'aborted', error: 'Request cancelled.'};
    }
    if (cause === 'timeout') {
      return {
        ok: false,
        kind: 'timeout',
        error: `The model did not answer within ${Math.round(timeoutMs / 1000)}s. Check your connection, or try a faster model in Settings.`,
      };
    }
    return {ok: false, kind: 'error', error: `Network error: ${e?.message ?? 'Unknown'}`};
  } finally {
    deadline.cleanup();
  }
}

/**
 * The Anthropic API rejects an unknown model with a 404 `not_found_error`, and rejects a
 * malformed model string with a 400 `invalid_request_error` whose message mentions "model".
 * Returns the API's own message when the error is model-related, otherwise undefined.
 */
function extractInvalidModelMessage(status: number, errorBody: string): string | undefined {
  let parsed: any;
  try {
    parsed = JSON.parse(errorBody);
  } catch {
    return undefined;
  }

  const errorType: string | undefined = parsed?.error?.type;
  const message: string | undefined = parsed?.error?.message;
  if (!message) return undefined;

  if (status === 404 && errorType === 'not_found_error') {
    return message;
  }
  if (status === 400 && errorType === 'invalid_request_error' && /model/i.test(message)) {
    return message;
  }
  return undefined;
}
