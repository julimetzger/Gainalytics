/**
 * GH-504: who answers AI Chat and Coach Insights.
 * - `claude`: Anthropic Claude with the user's own API key (the default for everyone).
 * - `chatgpt`: the user's ChatGPT plan via "Sign in with ChatGPT".
 */
export type AiProvider = 'claude' | 'chatgpt';

/** Anything other than an explicit ChatGPT choice — including no choice at all — stays on Claude. */
export function resolveAiProvider(stored: unknown): AiProvider {
  return stored === 'chatgpt' ? 'chatgpt' : 'claude';
}
