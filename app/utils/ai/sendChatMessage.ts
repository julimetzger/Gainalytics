/**
 * Chat API wrapper — sends a full conversation history to Anthropic /v1/messages.
 * Full history is intentional: no truncation, costs grow linearly with conversation length.
 * TODO(cost-warning): consider token limits / summary rollup in a future ticket.
 */

import {DEFAULT_ANTHROPIC_MODEL} from '../llmApi';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const CHAT_MAX_TOKENS = 1024;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** UI-only: true if training context JSON was attached on this assistant reply. Stripped before API call. */
  hadContext?: boolean;
}

export type SendChatResult =
  | {ok: true; text: string; hadContext: boolean}
  | {ok: false; error: string};

export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  systemPrompt?: string,
  model: string = DEFAULT_ANTHROPIC_MODEL,
): Promise<SendChatResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {ok: false, error: 'No API key configured.'};
  }

  const hadContext = Boolean(systemPrompt && systemPrompt.includes('Analysis context'));
  // Strip UI-only fields before sending to the API
  const apiMessages = messages.map(({role, content}) => ({role, content}));

  console.log(
    `[sendChatMessage] context_in_request=${hadContext} system_len=${systemPrompt?.length ?? 0} msg_count=${apiMessages.length}`,
  );

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
    });

    if (response.status === 401) {
      return {ok: false, error: 'Invalid API key. Check your settings.'};
    }
    if (response.status === 429) {
      return {ok: false, error: 'API rate limit reached. Try again later.'};
    }
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      const invalidModelMessage = extractInvalidModelMessage(response.status, errorBody);
      if (invalidModelMessage) {
        return {
          ok: false,
          error: `Invalid model "${model}": ${invalidModelMessage} Check the Claude Model field in Settings.`,
        };
      }
      return {ok: false, error: `API error (${response.status}): ${errorBody}`};
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? '';
    return {ok: true, text, hadContext};
  } catch (e: any) {
    return {ok: false, error: `Network error: ${e?.message ?? 'Unknown'}`};
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
