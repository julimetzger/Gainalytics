import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LlmRequestOptions, LlmResult, callAnthropicClaude} from '../../utils/llmApi';
import {callChatGpt} from '../../utils/ai/chatgpt/chatgptChat';
import {useAiCredentials} from '../../utils/ai/useAiCredentials';
import {useAiProvider} from '../../redux/settings/use/useAiProvider';
import {AiProvider} from '../../models/AiProvider';
import {useChatGptModel} from '../../redux/settings/use/useChatGptModel';
import {insightCache} from '../../utils/insightCache';
import {secureStorage, subscribeToApiKeyChanges} from '../../utils/secureStorage';
import {useAnthropicModel} from '../../redux/settings/use/useAnthropicModel';

/** Sends one insight prompt to the selected provider. */
type InsightRequester = (system: string, user: string, options: LlmRequestOptions) => Promise<LlmResult>;

export type CoachInsightState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {status: 'done'; text: string; generatedAt: number; truncated: boolean}
  | {status: 'no_key'}
  | {status: 'error'; message: string};

export interface CoachInsightRequest {
  system: string;
  user: string;
}

interface Options {
  /** Cache key of what the insight is about ('' = not cacheable). */
  insightKey: string;
  /** False when there is nothing to ask about — the card stays hidden, no request. */
  enabled: boolean;
  /** When false, the API call is suppressed (off-screen swiper pane). */
  isActive: boolean;
  prompt: string;
  /** Changes when the Redux data the request is built from arrives. */
  dataVersion: string;
  /** Builds the request from the latest data; undefined means "not enough data". */
  buildRequest: (prompt: string) => CoachInsightRequest | undefined;
}

// GH-504: ChatGPT insights get their own namespace so switching provider never shows the
// other provider's answer. Claude keeps the unprefixed keys of existing installs.
const providerKey = (key: string, provider: AiProvider) => (key && provider === 'chatgpt' ? `chatgpt:${key}` : key);

/**
 * The request/caching state machine behind every Coach Insight card (micro and, since
 * GH-645, single training): one request when the card is active, cached per key,
 * "Ask again" via refresh, and `no_key` when the selected provider has no credentials.
 */
export const useCoachInsight = ({insightKey, enabled, isActive, prompt, dataVersion, buildRequest}: Options) => {
  const [state, setState] = useState<CoachInsightState>({status: 'idle'});

  // Reactive API key: update when user saves / removes the key in Settings.
  const [apiKey, setApiKey] = useState<string | undefined>(() => {
    try {
      return secureStorage.getAnthropicApiKey();
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const unsub = subscribeToApiKeyChanges(() => {
      try {
        setApiKey(secureStorage.getAnthropicApiKey());
      } catch {
        setApiKey(undefined);
      }
    });
    return unsub;
  }, []);

  const model = useAnthropicModel();
  const provider = useAiProvider();
  const chatgptModel = useChatGptModel();
  const chatgptSignedIn = useAiCredentials('chatgpt');

  // GH-504: undefined when the selected provider has no credentials.
  const requester = useMemo<InsightRequester | undefined>(() => {
    if (provider === 'chatgpt') {
      return chatgptSignedIn ? (system, user, options) => callChatGpt(system, user, chatgptModel, options) : undefined;
    }
    return apiKey ? (system, user, options) => callAnthropicClaude(apiKey, system, user, model, options) : undefined;
  }, [provider, chatgptSignedIn, chatgptModel, apiKey, model]);

  const key = providerKey(insightKey, provider);

  // The insight request currently in flight, so it can be cancelled or superseded.
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  // Always build from the latest data, without making the fetch depend on it.
  const buildRequestRef = useRef(buildRequest);
  buildRequestRef.current = buildRequest;

  const fetchInsight = useCallback(
    (cKey: string, currentRequester: InsightRequester | undefined, currentEnabled: boolean, currentPrompt: string, currentProvider: AiProvider) => {
      if (!currentEnabled) {
        setState({status: 'idle'});
        return;
      }

      // GH-504: signed out of ChatGPT → no insight at all, not even a cached one.
      if (currentProvider === 'chatgpt' && !currentRequester) {
        setState({status: 'no_key'});
        return;
      }

      const cached = cKey ? insightCache.get(cKey) : undefined;
      if (cached) {
        setState({status: 'done', text: cached.text, generatedAt: cached.generatedAt, truncated: cached.truncated === true});
        return;
      }

      if (!currentRequester) {
        setState({status: 'no_key'});
        return;
      }

      const request = buildRequestRef.current(currentPrompt);
      if (!request) {
        setState({status: 'error', message: 'Not enough data for an insight yet.'});
        return;
      }

      setState({status: 'loading'});

      // GH-447: one controller per attempt. Aborting it both cancels the request that is in
      // flight and marks its response as stale, so a superseded call can never write state.
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      currentRequester(request.system, request.user, {signal: controller.signal}).then((result) => {
        if (controller.signal.aborted) return;
        requestRef.current = null;

        if (result.ok) {
          const generatedAt = Date.now();
          insightCache.set(cKey, {text: result.text, generatedAt, truncated: result.truncated});
          setState({status: 'done', text: result.text, generatedAt, truncated: result.truncated});
          return;
        }

        const err = result.error;
        if (err.type === 'no_key') {
          setState({status: 'no_key'});
        } else if (err.type === 'invalid_key') {
          setState({status: 'error', message: 'Invalid API key. Check your settings.'});
        } else if (err.type === 'rate_limit') {
          setState({status: 'error', message: 'API rate limit reached. Try again later.'});
        } else if (err.type === 'timeout') {
          // GH-447: without this the card would spin forever whenever the call never returns.
          setState({status: 'error', message: `The insight took longer than ${Math.round(err.timeoutMs / 1000)}s. Tap refresh to try again.`});
        } else if (err.type === 'aborted') {
          setState({status: 'idle'});
        } else if (err.type === 'provider_error') {
          setState({status: 'error', message: err.message});
        } else if (err.type === 'network') {
          setState({status: 'error', message: `Network error: ${err.message}`});
        } else {
          setState({status: 'error', message: `API error (${err.status}): ${err.message}`});
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!isActive) return;
    fetchInsight(key, requester, enabled, prompt, provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, requester, isActive, enabled, dataVersion, prompt]);

  const refresh = () => {
    if (key) {
      insightCache.delete(key);
    }
    setState({status: 'loading'});
    fetchInsight(key, requester, enabled, prompt, provider);
  };

  return {state, provider, refresh};
};
