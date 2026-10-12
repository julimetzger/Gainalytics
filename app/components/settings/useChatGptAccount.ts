import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ChatGptSession,
  cancelSignIn,
  loadSession,
  signInWithChatGpt,
  signOut,
  subscribeToChatGptSession,
} from '../../utils/ai/chatgpt/chatgptSession';
import {listChatGptModels} from '../../utils/ai/chatgpt/chatgptChat';
import {describeSignInError} from '../../utils/ai/chatgpt/chatgptErrors';

export type SignInPhase = 'idle' | 'waiting' | 'exchanging';

export interface AccountMessage {
  type: 'info' | 'error';
  text: string;
}

function safeLoadSession(): ChatGptSession | null {
  try {
    return loadSession();
  } catch {
    return null;
  }
}

/**
 * GH-504: state and actions behind the ChatGPT part of Settings → AI Coach — the stored
 * sign-in, a running browser sign-in, and the models the plan offers.
 */
export function useChatGptAccount() {
  const [session, setSession] = useState<ChatGptSession | null>(safeLoadSession);
  const [phase, setPhase] = useState<SignInPhase>('idle');
  const [message, setMessage] = useState<AccountMessage | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  // Set synchronously so a double tap cannot start a second sign-in before React re-renders.
  const busyRef = useRef(false);

  useEffect(() => subscribeToChatGptSession(() => setSession(safeLoadSession())), []);

  const signedIn = session !== null;
  const planUsage = session?.planUsage ?? false;

  const reloadModels = useCallback(async () => {
    setModelsError(null);
    const result = await listChatGptModels();
    if (result.ok) {
      setModels(result.models.map(m => m.slug));
    } else {
      setModels(null);
      setModelsError(result.message);
    }
  }, []);

  useEffect(() => {
    if (signedIn && planUsage) {
      reloadModels();
    } else {
      setModels(null);
    }
  }, [signedIn, planUsage, reloadModels]);

  const startSignIn = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('waiting');
    setMessage(null);
    try {
      await signInWithChatGpt(progress => {
        if (progress.step === 'exchanging') setPhase('exchanging');
      });
      setMessage(null);
    } catch (e) {
      setMessage({type: 'error', text: describeSignInError(e)});
    } finally {
      busyRef.current = false;
      setPhase('idle');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    const {remoteRevoked} = await signOut();
    setMessage({
      type: 'info',
      text: remoteRevoked
        ? 'Signed out.'
        : 'Signed out on this device. Remote sign-out was not confirmed — you can disconnect Gainalytics in ChatGPT settings.',
    });
  }, []);

  return {
    session,
    phase,
    message,
    models,
    modelsError,
    startSignIn,
    cancelSignIn,
    signOut: handleSignOut,
    reloadModels,
  };
}
