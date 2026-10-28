/**
 * GH-544 — sends the "Plan with AI" prompt to the selected provider.
 *
 * Claude is forced to call the plan tool (structured output). The ChatGPT plan only returns
 * text, so the prompt asks it for a fenced JSON block. The validator checks both alike.
 */
import {AiProvider} from '../../../models/AiProvider';
import {LlmError, LlmRequestOptions, LlmResult, callAnthropicClaude} from '../../llmApi';
import {callChatGpt} from '../chatgpt/chatgptChat';
import {AI_PLAN_TOOL} from './aiPlanContext';

/** A full training as JSON is longer than a coach insight; give it room. */
export const AI_PLAN_MAX_TOKENS = 4096;
export const AI_PLAN_TIMEOUT_MS = 120_000;

/**
 * E2E test hook: with this Anthropic key nothing is sent — the user's text itself is the
 * model's answer. Maestro uses it to plan from a fixed answer without a provider call.
 */
export const AI_PLAN_ECHO_API_KEY = 'sk-ant-e2e-echo-answer';

export interface AiPlanCredentials {
  provider: AiProvider;
  anthropicApiKey?: string;
  anthropicModel: string;
  chatgptModel?: string;
}

export function requestAiPlan(
  credentials: AiPlanCredentials,
  prompt: {system: string; user: string},
  userText: string,
  signal?: AbortSignal,
): Promise<LlmResult> {
  const options: LlmRequestOptions = {signal, timeoutMs: AI_PLAN_TIMEOUT_MS, maxTokens: AI_PLAN_MAX_TOKENS};
  if (credentials.provider === 'chatgpt') {
    return callChatGpt(prompt.system, prompt.user, credentials.chatgptModel, options);
  }
  if (credentials.anthropicApiKey?.trim() === AI_PLAN_ECHO_API_KEY) {
    return Promise.resolve({ok: true, text: userText, truncated: false});
  }
  return callAnthropicClaude(credentials.anthropicApiKey ?? '', prompt.system, prompt.user, credentials.anthropicModel, {
    ...options,
    tool: AI_PLAN_TOOL,
  });
}

/** The message for a failed request; undefined when the user cancelled it. */
export function describeAiPlanError(error: LlmError): string | undefined {
  switch (error.type) {
    case 'no_key':
      return 'No AI configured. Add an Anthropic API key or sign in to ChatGPT in Settings → AI Configuration.';
    case 'invalid_key':
      return 'Invalid API key. Check your settings.';
    case 'rate_limit':
      return 'API rate limit reached. Try again later.';
    case 'timeout':
      return `The AI did not answer within ${Math.round(error.timeoutMs / 1000)}s. Try again.`;
    case 'aborted':
      return undefined;
    case 'network':
      return `Network error: ${error.message}`;
    case 'provider_error':
      return error.message;
    case 'api_error':
      return `API error (${error.status}): ${error.message}`;
  }
}
