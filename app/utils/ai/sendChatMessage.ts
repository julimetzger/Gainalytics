/**
 * Chat API wrapper — sends a full conversation history to Anthropic /v1/messages.
 * Full history is intentional: no truncation, costs grow linearly with conversation length.
 * TODO(cost-warning): consider token limits / summary rollup in a future ticket.
 */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const CHAT_MODEL = 'claude-haiku-4-5-20251001';
const CHAT_MAX_TOKENS = 1024;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type SendChatResult =
  | {ok: true; text: string}
  | {ok: false; error: string};

export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string,
  systemPrompt?: string,
): Promise<SendChatResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {ok: false, error: 'No API key configured.'};
  }

  try {
    const bodyPayload: Record<string, unknown> = {
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      messages,
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
      return {ok: false, error: `API error (${response.status}): ${errorBody}`};
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? '';
    return {ok: true, text};
  } catch (e: any) {
    return {ok: false, error: `Network error: ${e?.message ?? 'Unknown'}`};
  }
}
