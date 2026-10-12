/**
 * GH-504 PoC — sign-in orchestration and session persistence for "Sign in with ChatGPT".
 * Tokens live only in the encrypted secure store, never in Redux, logs or the repo.
 */
import {Linking, NativeModules} from 'react-native';
import {getSecureStore} from '../../secureStorage';
import {
  LOOPBACK_CALLBACK_PATH,
  LOOPBACK_DEFAULT_PORT,
  OAuthError,
  buildAuthorizeUrl,
  checkIdToken,
  exchangeCode,
  hasPlanUsageScope,
  loopbackRedirectUri,
  parseCallback,
  refreshTokens,
  revokeRefreshToken,
} from './chatgptAuth';

interface LoopbackModule {
  randomToken(byteCount: number): Promise<string>;
  randomUuid(): Promise<string>;
  createPkce(): Promise<{verifier: string; challenge: string}>;
  start(preferredPort: number): Promise<number>;
  awaitCallback(path: string, timeoutMs: number): Promise<string>;
  stop(): Promise<void>;
}

const Loopback: LoopbackModule | undefined = NativeModules.ChatGptLoopback;

const HOST_ID_KEY = 'chatgpt_poc_host_id';
const SESSION_KEY = 'chatgpt_poc_session';
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

export interface ChatGptSession {
  clientId: string;
  sub?: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  scope: string;
  expiresAt: number;
  planUsage: boolean;
}

export type SignInProgress =
  | {step: 'listening'; port: number; authorizeUrl: string; state: string}
  | {step: 'callback_received'}
  | {step: 'exchanging'};

export function isLoopbackAvailable(): boolean {
  return !!Loopback;
}

async function getHostId(): Promise<string> {
  const store = getSecureStore();
  let hostId = store.getString(HOST_ID_KEY);
  if (!hostId) {
    hostId = `urn:uuid:${await Loopback!.randomUuid()}`;
    store.set(HOST_ID_KEY, hostId);
  }
  return hostId;
}

export function loadSession(): ChatGptSession | null {
  const raw = getSecureStore().getString(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChatGptSession;
  } catch {
    return null;
  }
}

function saveSession(session: ChatGptSession): void {
  getSecureStore().set(SESSION_KEY, JSON.stringify(session));
}

export async function signInWithChatGpt(
  onProgress: (p: SignInProgress) => void,
): Promise<ChatGptSession> {
  if (!Loopback) throw new Error('ChatGptLoopback native module missing — rebuild the APK.');
  const previous = loadSession();
  const hostId = await getHostId();
  const pkce = await Loopback.createPkce();
  const state = await Loopback.randomToken(24);
  const nonce = await Loopback.randomToken(24);

  const port = await Loopback.start(LOOPBACK_DEFAULT_PORT);
  const redirectUri = loopbackRedirectUri(port);
  const authorizeUrl = buildAuthorizeUrl({
    clientId: previous?.clientId,
    hostId,
    redirectUri,
    state,
    nonce,
    codeChallenge: pkce.challenge,
    idTokenHint: previous?.idToken,
    loginHint: previous?.email,
  });

  // Start waiting before the browser opens so the redirect cannot race the listener.
  const callbackPromise = Loopback.awaitCallback(LOOPBACK_CALLBACK_PATH, SIGN_IN_TIMEOUT_MS);
  onProgress({step: 'listening', port, authorizeUrl, state});
  try {
    await Linking.openURL(authorizeUrl);
  } catch (e) {
    await Loopback.stop();
    throw e;
  }

  const target = await callbackPromise;
  onProgress({step: 'callback_received'});
  const cb = parseCallback(target, state, previous?.clientId);
  if (!cb.ok) {
    throw new OAuthError(cb.error, cb.description ?? cb.error);
  }
  const clientId = cb.clientId ?? previous?.clientId;
  if (!clientId) throw new OAuthError('missing_client_id', 'Callback did not return an issued client_id');

  onProgress({step: 'exchanging'});
  const tokens = await exchangeCode({clientId, code: cb.code, codeVerifier: pkce.verifier, redirectUri});
  let sub: string | undefined;
  let email: string | undefined;
  if (tokens.id_token) {
    const check = checkIdToken(tokens.id_token, clientId, nonce);
    if (!check.ok) throw new OAuthError('invalid_id_token', check.reason ?? 'ID token rejected');
    sub = check.sub;
    email = check.email;
  }
  const scope = tokens.scope ?? cb.scope ?? '';
  const session: ChatGptSession = {
    clientId,
    sub,
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    scope,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    planUsage: hasPlanUsageScope(scope),
  };
  saveSession(session);
  return session;
}

/** Returns a session with a valid access token, refreshing if it expires within 60 s. */
export async function ensureFreshSession(session: ChatGptSession): Promise<ChatGptSession> {
  if (session.expiresAt - Date.now() > 60_000 || !session.refreshToken) return session;
  const tokens = await refreshTokens(session.clientId, session.refreshToken);
  const scope = tokens.scope ?? session.scope;
  const next: ChatGptSession = {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    idToken: tokens.id_token ?? session.idToken,
    scope,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    planUsage: hasPlanUsageScope(scope),
  };
  saveSession(next);
  return next;
}

/** Revokes the refresh token remotely (best effort) and clears local tokens. */
export async function signOut(): Promise<{remoteRevoked: boolean}> {
  const session = loadSession();
  let remoteRevoked = false;
  if (session?.refreshToken) {
    try {
      await revokeRefreshToken(session.clientId, session.refreshToken);
      remoteRevoked = true;
    } catch {
      remoteRevoked = false;
    }
  }
  getSecureStore().delete(SESSION_KEY);
  return {remoteRevoked};
}

export async function cancelSignIn(): Promise<void> {
  await Loopback?.stop();
}
