/**
 * GH-504 — AI Chat and Coach Insight requests against the user's ChatGPT plan.
 *
 * Mirrors the Claude path (sendChatMessage / callAnthropicClaude): same result shapes, the
 * same Stop button and deadline (withTimeout), so the screens treat both providers alike.
 */
import {withTimeout} from '../withTimeout';
import {TRUNCATION_NOTICE} from '../truncatedText';
import type {ChatMessage, SendChatOptions, SendChatResult} from '../sendChatMessage';
import type {LlmRequestOptions, LlmResult} from '../../llmApi';
import {ChatGptFailure, classifyErrorCode, classifyHttpError, describeChatGptFailure} from './chatgptErrors';
import {ChatGptReauthRequiredError, ChatGptSession, getFreshSession} from './chatgptSession';
import {
  ChatGptModel,
  ConversationTurn,
  MODELS_URL,
  RESPONSES_URL,
  buildResponsesBody,
  parseModels,
  parseResponsesStream,
} from './chatgptResponses';

const CHAT_TIMEOUT_MS = 180_000;
const INSIGHT_TIMEOUT_MS = 90_000;

type ChatGptOutcome = {ok: true; text: string; truncated: boolean} | {ok: false; failure: ChatGptFailure};

/** Thrown inside a request to end it with a specific failure. */
class FailureSignal extends Error {
  constructor(public readonly failure: ChatGptFailure) {
    super(failure.kind);
  }
}

async function sessionOrFail(force: boolean): Promise<ChatGptSession> {
  let session: ChatGptSession | null;
  try {
    session = await getFreshSession({force});
  } catch (e: any) {
    if (e instanceof ChatGptReauthRequiredError) throw new FailureSignal({kind: 'reauth_required'});
    // Network / server trouble while refreshing: the sign-in is kept.
    throw new FailureSignal({kind: 'network', message: e?.message ?? 'Token refresh failed'});
  }
  if (!session) throw new FailureSignal({kind: 'not_signed_in'});
  if (!session.planUsage) throw new FailureSignal({kind: 'plan_usage_missing'});
  return session;
}

/** Lists the models the signed-in plan offers. */
export async function fetchChatGptModels(signal?: AbortSignal): Promise<ChatGptModel[]> {
  const session = await sessionOrFail(false);
  const res = await fetch(MODELS_URL, {headers: {Authorization: `Bearer ${session.accessToken}`}, signal});
  if (!res.ok) {
    throw new FailureSignal(classifyHttpError(res.status, await res.text(), ''));
  }
  return parseModels(await res.json());
}

/** The user's chosen model, or the first one the plan lists. */
async function resolveModel(model: string | undefined, signal: AbortSignal): Promise<string> {
  if (model && model.trim()) return model.trim();
  const models = await fetchChatGptModels(signal);
  if (models.length === 0) throw new FailureSignal({kind: 'no_model'});
  return models[0].slug;
}

async function postResponses(accessToken: string, body: string, signal: AbortSignal): Promise<Response> {
  return fetch(RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body,
    signal,
  });
}

/**
 * One Responses request. On a 401 the token is refreshed once and the request repeated —
 * the access token may have been revoked or rotated before its stored expiry.
 */
export async function requestChatGpt(
  instructions: string,
  turns: ConversationTurn[],
  model: string | undefined,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ChatGptOutcome> {
  const deadline = withTimeout(timeoutMs, signal);
  let usedModel = model?.trim() ?? '';
  try {
    let session = await sessionOrFail(false);
    usedModel = await resolveModel(model, deadline.signal);
    const body = JSON.stringify(buildResponsesBody(usedModel, instructions, turns));

    let res = await postResponses(session.accessToken, body, deadline.signal);
    if (res.status === 401) {
      session = await sessionOrFail(true);
      res = await postResponses(session.accessToken, body, deadline.signal);
    }
    const text = await res.text();
    if (!res.ok) {
      return {ok: false, failure: classifyHttpError(res.status, text, usedModel)};
    }
    const parsed = parseResponsesStream(text);
    if (!parsed.ok) {
      return {ok: false, failure: classifyErrorCode(parsed.code, parsed.message, undefined, usedModel)};
    }
    return {ok: true, text: parsed.text, truncated: parsed.truncated};
  } catch (e: any) {
    const cause = deadline.getCause();
    if (cause === 'caller') return {ok: false, failure: {kind: 'aborted'}};
    if (cause === 'timeout') return {ok: false, failure: {kind: 'timeout', timeoutMs}};
    if (e instanceof FailureSignal) return {ok: false, failure: e.failure};
    return {ok: false, failure: {kind: 'network', message: e?.message ?? 'Unknown'}};
  } finally {
    deadline.cleanup();
  }
}

/** AI Chat: same contract as sendChatMessage (Claude). */
export async function sendChatGptMessage(
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  model: string | undefined,
  options: SendChatOptions = {},
): Promise<SendChatResult> {
  const hadContext = Boolean(systemPrompt && systemPrompt.includes('Analysis context'));
  const turns = messages.map(({role, content}) => ({role, content}));
  const result = await requestChatGpt(
    systemPrompt ?? '',
    turns,
    model,
    options.timeoutMs ?? CHAT_TIMEOUT_MS,
    options.signal,
  );
  if (result.ok) {
    const text = result.truncated ? `${result.text}\n\n_(${TRUNCATION_NOTICE})_` : result.text;
    return {ok: true, text, hadContext, truncated: result.truncated};
  }
  const {failure} = result;
  const kind =
    failure.kind === 'not_signed_in'
      ? 'no_key'
      : failure.kind === 'aborted'
        ? 'aborted'
        : failure.kind === 'timeout'
          ? 'timeout'
          : 'error';
  return {ok: false, kind, error: describeChatGptFailure(failure)};
}

/** Coach Insight: same contract as callAnthropicClaude. */
export async function callChatGpt(
  systemPrompt: string,
  userMessage: string,
  model: string | undefined,
  options: LlmRequestOptions = {},
): Promise<LlmResult> {
  const result = await requestChatGpt(
    systemPrompt,
    [{role: 'user', content: userMessage}],
    model,
    options.timeoutMs ?? INSIGHT_TIMEOUT_MS,
    options.signal,
  );
  if (result.ok) return {ok: true, text: result.text, truncated: result.truncated};
  const {failure} = result;
  if (failure.kind === 'not_signed_in') return {ok: false, error: {type: 'no_key'}};
  if (failure.kind === 'aborted') return {ok: false, error: {type: 'aborted'}};
  if (failure.kind === 'timeout') return {ok: false, error: {type: 'timeout', timeoutMs: failure.timeoutMs}};
  return {ok: false, error: {type: 'provider_error', message: describeChatGptFailure(failure)}};
}

export type ModelListResult = {ok: true; models: ChatGptModel[]} | {ok: false; message: string};

/** Settings: the models to choose from, or a readable reason why they could not be loaded. */
export async function listChatGptModels(): Promise<ModelListResult> {
  try {
    return {ok: true, models: await fetchChatGptModels()};
  } catch (e: any) {
    const failure: ChatGptFailure =
      e instanceof FailureSignal ? e.failure : {kind: 'network', message: e?.message ?? 'Unknown'};
    return {ok: false, message: describeChatGptFailure(failure)};
  }
}
