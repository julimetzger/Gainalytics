/**
 * GH-504 PoC — Responses API calls with a ChatGPT plan access token.
 *
 * Plan usage requires `store: false` and `stream: true`, `instructions` instead of
 * system messages, and no temperature/max_output_tokens/… fields
 * (https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
 * RN fetch cannot read a streaming body incrementally, so the PoC reads the whole
 * SSE body once the stream closes and assembles the text from the events.
 */
import {OPENAI_RESOURCE} from './chatgptAuth';

export interface ChatGptModel {
  slug: string;
  visibility?: string;
}

export type ResponsesResult =
  | {ok: true; text: string; model?: string}
  | {ok: false; code: string; message: string; status?: number};

export async function listModels(accessToken: string): Promise<ChatGptModel[]> {
  const res = await fetch(`${OPENAI_RESOURCE}/models`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  if (!res.ok) {
    throw new Error(`GET /v1/models failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  const data: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return data
    .map(m => ({slug: m.slug ?? m.id, visibility: m.visibility}))
    .filter(m => typeof m.slug === 'string' && (m.visibility === undefined || m.visibility === 'list'));
}

export function buildResponsesBody(model: string, instructions: string, question: string) {
  return {
    model,
    instructions,
    input: [{role: 'user', content: [{type: 'input_text', text: question}]}],
    store: false,
    stream: true,
  };
}

/** Assembles the result from a complete `text/event-stream` body. */
export function parseResponsesStream(sse: string): ResponsesResult {
  let text = '';
  let completed = false;
  let model: string | undefined;
  for (const line of sse.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }
    switch (event.type) {
      case 'response.output_text.delta':
        text += event.delta ?? '';
        break;
      case 'response.completed':
        completed = true;
        model = event.response?.model;
        break;
      case 'response.failed': {
        const err = event.response?.error ?? {};
        return {ok: false, code: err.code ?? 'response_failed', message: err.message ?? 'Response failed'};
      }
      case 'response.incomplete':
        return {
          ok: false,
          code: 'response_incomplete',
          message: event.response?.incomplete_details?.reason ?? 'Response incomplete',
        };
      case 'error':
        return {ok: false, code: event.code ?? 'stream_error', message: event.message ?? 'Stream error'};
    }
  }
  if (!completed) {
    return {ok: false, code: 'stream_interrupted', message: 'Stream ended without response.completed'};
  }
  return {ok: true, text, model};
}

export async function askChatGpt(
  accessToken: string,
  model: string,
  instructions: string,
  question: string,
): Promise<ResponsesResult> {
  let res: Response;
  try {
    res = await fetch(`${OPENAI_RESOURCE}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(buildResponsesBody(model, instructions, question)),
    });
  } catch (e: any) {
    return {ok: false, code: 'network', message: String(e?.message ?? e)};
  }
  const body = await res.text();
  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = body.slice(0, 300);
    try {
      const json = JSON.parse(body);
      code = json.error?.code ?? code;
      message = json.error?.message ?? json.detail ?? message;
    } catch {
      // keep raw excerpt
    }
    return {ok: false, code, message, status: res.status};
  }
  return parseResponsesStream(body);
}
