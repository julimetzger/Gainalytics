/**
 * GH-504 — Responses API wire format for requests with a ChatGPT plan access token.
 *
 * Plan usage requires `store: false` and `stream: true`, `instructions` instead of
 * system messages, the whole history in `input`, and no temperature/max_output_tokens/…
 * fields (https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
 * RN fetch cannot read a streaming body incrementally, so the whole SSE body is read once the
 * stream closes and the text is assembled from its events.
 */
import {OPENAI_RESOURCE} from './chatgptAuth';

export const RESPONSES_URL = `${OPENAI_RESOURCE}/responses`;
export const MODELS_URL = `${OPENAI_RESOURCE}/models`;

export interface ChatGptModel {
  slug: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

type ResponsesInputItem =
  | {type: 'message'; role: 'user'; content: [{type: 'input_text'; text: string}]}
  | {type: 'message'; role: 'assistant'; content: [{type: 'output_text'; text: string}]};

export interface ResponsesBody {
  model: string;
  instructions: string;
  input: ResponsesInputItem[];
  store: false;
  stream: true;
}

export type StreamResult =
  | {ok: true; text: string; truncated: boolean}
  | {ok: false; code: string; message: string};

/** Parses the /v1/models body; only models meant to be listed are returned. */
export function parseModels(json: unknown): ChatGptModel[] {
  const root = json as {data?: unknown; models?: unknown} | null;
  const data = Array.isArray(root?.data) ? root!.data : Array.isArray(root?.models) ? root!.models : [];
  return (data as {slug?: unknown; id?: unknown; visibility?: unknown}[])
    .map(m => ({slug: m.slug ?? m.id, visibility: m.visibility}))
    .filter((m): m is {slug: string; visibility: unknown} => typeof m.slug === 'string')
    .filter(m => m.visibility === undefined || m.visibility === 'list')
    .map(m => ({slug: m.slug}));
}

export function toResponsesInput(turns: ConversationTurn[]): ResponsesInputItem[] {
  return turns.map(turn =>
    turn.role === 'user'
      ? {type: 'message', role: 'user', content: [{type: 'input_text', text: turn.content}]}
      : {type: 'message', role: 'assistant', content: [{type: 'output_text', text: turn.content}]},
  );
}

export function buildResponsesBody(model: string, instructions: string, turns: ConversationTurn[]): ResponsesBody {
  return {model, instructions, input: toResponsesInput(turns), store: false, stream: true};
}

/** Assembles the result from a complete `text/event-stream` body. */
export function parseResponsesStream(sse: string): StreamResult {
  let text = '';
  let completed = false;
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
        break;
      case 'response.failed': {
        const err = event.response?.error ?? {};
        return {ok: false, code: err.code ?? 'response_failed', message: err.message ?? 'Response failed'};
      }
      case 'response.incomplete':
        // The model stopped early (no output cap is allowed, so this is rare): keep what arrived.
        if (text.trim()) return {ok: true, text, truncated: true};
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
    return {ok: false, code: 'stream_interrupted', message: 'The answer stream ended unexpectedly.'};
  }
  return {ok: true, text, truncated: false};
}
