import {useEffect, useState} from 'react';
import {AiProvider} from '../../models/AiProvider';
import {secureStorage, subscribeToApiKeyChanges} from '../secureStorage';
import {hasChatGptSession, subscribeToChatGptSession} from './chatgpt/chatgptSession';

function hasCredentials(provider: AiProvider): boolean {
  try {
    return provider === 'chatgpt' ? hasChatGptSession() : secureStorage.hasAnthropicApiKey();
  } catch {
    return false;
  }
}

/**
 * GH-504: whether the selected provider can be used right now — an Anthropic API key for
 * Claude, a stored sign-in for ChatGPT. Re-evaluates when either credential changes.
 */
export function useAiCredentials(provider: AiProvider): boolean {
  const [ready, setReady] = useState(() => hasCredentials(provider));

  useEffect(() => {
    setReady(hasCredentials(provider));
    const update = () => setReady(hasCredentials(provider));
    const unsubscribe =
      provider === 'chatgpt' ? subscribeToChatGptSession(update) : subscribeToApiKeyChanges(update);
    return () => {
      unsubscribe();
    };
  }, [provider]);

  return ready;
}
