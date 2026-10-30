/**
 * GH-504 — "Sign in with ChatGPT": sign-in orchestration and session persistence.
 *
 * Follows OpenAI's session guidance
 * (https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions):
 * the registration (issued client id + account) is stored separately from the revocable token
 * set, so signing out or a dead refresh token only clears the tokens and the next sign-in
 * re-authorizes the same client instead of registering a new one.
 *
 * Tokens live only in the encrypted secure store, never in Redux, logs or the repo.
 */
import {Linking, NativeModules} from 'react-native';
import {getSecureStore} from '../../secureStorage';
import {
  LOOPBACK_CALLBACK_PATH,
  LOOPBACK_DEFAULT_PORT,
  OAuthError,
  TokenResponse,
  buildAuthorizeUrl,
  checkIdToken,
  exchangeCode,
  hasPlanUsageScope,
  isTerminalRefreshError,
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

const HOST_ID_KEY = 'chatgpt_host_id';
const REGISTRATION_KEY = 'chatgpt_registration';
const TOKENS_KEY = 'chatgpt_tokens';
// Written by the round-1/2 PoC build; migrated once so an existing sign-in survives the update.
const LEGACY_HOST_ID_KEY = 'chatgpt_poc_host_id';
const LEGACY_SESSION_KEY = 'chatgpt_poc_session';

const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;
const REFRESH_MARGIN_MS = 60_000;

/** The issued client and the account it is bound to. Survives sign-out. */
export interface ChatGptRegistration {
  clientId: string;
  sub?: string;
  email?: string;
}

/** The revocable credentials of one sign-in. */
export interface ChatGptTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  scope: string;
  expiresAt: number;
  planUsage: boolean;
}

export type ChatGptSession = ChatGptRegistration & ChatGptTokens;

export type SignInProgress = {step: 'listening'} | {step: 'exchanging'};

/** Thrown when the stored sign-in can no longer be used and the user has to sign in again. */
export class ChatGptReauthRequiredError extends Error {
  constructor(public readonly code: string) {
    super('ChatGPT sign-in expired');
  }
}

export class ChatGptSignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled');
  }
}

const listeners = new Set<() => void>();

/** Notifies on sign-in, sign-out and when unusable tokens are cleared. */
export function subscribeToChatGptSession(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(): void {
  listeners.forEach(cb => cb());
}

export function isLoopbackAvailable(): boolean {
  return !!Loopback;
}

function readJson<T>(key: string): T | null {
  const raw = getSecureStore().getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  getSecureStore().set(key, JSON.stringify(value));
}

function migrateLegacySession(): void {
  const store = getSecureStore();
  const legacyHostId = store.getString(LEGACY_HOST_ID_KEY);
  if (legacyHostId) {
    if (!store.getString(HOST_ID_KEY)) store.set(HOST_ID_KEY, legacyHostId);
    store.remove(LEGACY_HOST_ID_KEY);
  }
  const legacy = readJson<ChatGptSession>(LEGACY_SESSION_KEY);
  if (legacy) {
    if (!readJson(REGISTRATION_KEY) && legacy.clientId) {
      writeJson(REGISTRATION_KEY, {clientId: legacy.clientId, sub: legacy.sub, email: legacy.email});
      if (legacy.accessToken) {
        const {clientId, sub, email, ...tokens} = legacy;
        writeJson(TOKENS_KEY, tokens);
      }
    }
    store.remove(LEGACY_SESSION_KEY);
  }
}

export function loadRegistration(): ChatGptRegistration | null {
  migrateLegacySession();
  return readJson<ChatGptRegistration>(REGISTRATION_KEY);
}

/** The current sign-in, or null when signed out (the registration alone is not a session). */
export function loadSession(): ChatGptSession | null {
  const registration = loadRegistration();
  const tokens = readJson<ChatGptTokens>(TOKENS_KEY);
  if (!registration || !tokens?.accessToken) return null;
  return {...registration, ...tokens};
}

export function hasChatGptSession(): boolean {
  try {
    return loadSession() !== null;
  } catch {
    return false;
  }
}

function tokensFromResponse(tokens: TokenResponse, previous?: ChatGptTokens): ChatGptTokens {
  const scope = tokens.scope ?? previous?.scope ?? '';
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous?.refreshToken,
    idToken: tokens.id_token ?? previous?.idToken,
    scope,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    planUsage: hasPlanUsageScope(scope),
  };
}

// Bumped whenever the stored tokens are replaced or removed outside a refresh (sign-in,
// sign-out, terminal refresh error). A refresh that started under an older generation must not
// write its result back — otherwise a sign-out during the refresh would restore the old sign-in.
let sessionGeneration = 0;

function clearTokens(): void {
  sessionGeneration++;
  // A later caller must not join a refresh of the cleared sign-in.
  refreshInFlight = null;
  getSecureStore().remove(TOKENS_KEY);
  notify();
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

let signInInFlight: Promise<ChatGptSession> | null = null;
let signInCancelled = false;

/**
 * Opens the ChatGPT consent page in the browser and waits for the loopback redirect.
 * A second call while one is running joins the running attempt instead of starting a new
 * listener, so a double tap cannot close the first attempt's socket.
 */
export function signInWithChatGpt(onProgress: (p: SignInProgress) => void): Promise<ChatGptSession> {
  if (!signInInFlight) {
    signInCancelled = false;
    signInInFlight = runSignIn(onProgress).finally(() => {
      signInInFlight = null;
    });
  }
  return signInInFlight;
}

async function runSignIn(onProgress: (p: SignInProgress) => void): Promise<ChatGptSession> {
  if (!Loopback) throw new Error('ChatGPT sign-in is not available in this build.');
  const registration = loadRegistration();
  const previousTokens = readJson<ChatGptTokens>(TOKENS_KEY);
  const hostId = await getHostId();
  const pkce = await Loopback.createPkce();
  const state = await Loopback.randomToken(24);
  const nonce = await Loopback.randomToken(24);

  const port = await Loopback.start(LOOPBACK_DEFAULT_PORT);
  const redirectUri = loopbackRedirectUri(port);
  const authorizeUrl = buildAuthorizeUrl({
    clientId: registration?.clientId,
    hostId,
    redirectUri,
    state,
    nonce,
    codeChallenge: pkce.challenge,
    idTokenHint: previousTokens?.idToken,
    loginHint: registration?.email,
  });

  // Start waiting before the browser opens so the redirect cannot race the listener.
  // stop() also ends the native keep-alive that prevents Android from freezing the app while the
  // browser is in front — only after the token exchange, which otherwise stalls in the background.
  const callbackPromise = Loopback.awaitCallback(LOOPBACK_CALLBACK_PATH, SIGN_IN_TIMEOUT_MS);
  try {
    onProgress({step: 'listening'});
    await Linking.openURL(authorizeUrl);

    let target: string;
    try {
      target = await callbackPromise;
    } catch (e) {
      if (signInCancelled) throw new ChatGptSignInCancelledError();
      throw e;
    }
    const cb = parseCallback(target, state, registration?.clientId);
    if (!cb.ok) {
      throw new OAuthError(cb.error, cb.description ?? cb.error);
    }
    const clientId = cb.clientId ?? registration?.clientId;
    if (!clientId) throw new OAuthError('missing_client_id', 'Callback did not return an issued client_id');
    // Persist the issued client before the exchange: if the exchange fails, the next attempt
    // must re-authorize this client rather than register a new one.
    if (clientId !== registration?.clientId) {
      writeJson(REGISTRATION_KEY, {clientId} satisfies ChatGptRegistration);
    }

    onProgress({step: 'exchanging'});
    const tokens = await exchangeCode({clientId, code: cb.code, codeVerifier: pkce.verifier, redirectUri});
    let sub = registration?.sub;
    let email = registration?.email;
    if (tokens.id_token) {
      const check = checkIdToken(tokens.id_token, clientId, nonce);
      if (!check.ok) throw new OAuthError('invalid_id_token', check.reason ?? 'ID token rejected');
      sub = check.sub;
      email = check.email;
    }
    const nextRegistration: ChatGptRegistration = {clientId, sub, email};
    const nextTokens = tokensFromResponse(tokens);
    // The callback may not echo the granted scope in the token response.
    if (!tokens.scope && cb.scope) {
      nextTokens.scope = cb.scope;
      nextTokens.planUsage = hasPlanUsageScope(cb.scope);
    }
    sessionGeneration++;
    refreshInFlight = null;
    writeJson(REGISTRATION_KEY, nextRegistration);
    writeJson(TOKENS_KEY, nextTokens);
    notify();
    return {...nextRegistration, ...nextTokens};
  } finally {
    await Loopback.stop();
  }
}

/** Stops a running sign-in; the pending signInWithChatGpt() rejects with ChatGptSignInCancelledError. */
export async function cancelSignIn(): Promise<void> {
  if (!signInInFlight) return;
  signInCancelled = true;
  await Loopback?.stop();
}

let refreshInFlight: Promise<ChatGptSession | null> | null = null;

/**
 * Returns a session whose access token is valid for at least another minute, refreshing it
 * when needed. Refreshes are serialized: concurrent callers share one request, because the
 * refresh token rotates and a second request with the old one fails as reused.
 *
 * Throws ChatGptReauthRequiredError (after clearing the tokens) on a terminal refresh error;
 * network and server errors propagate unchanged and keep the sign-in. Resolves null when the
 * user signed out while the refresh was running.
 */
export function getFreshSession(options: {force?: boolean} = {}): Promise<ChatGptSession | null> {
  const session = loadSession();
  if (!session) return Promise.resolve(null);
  const needsRefresh = options.force || session.expiresAt - Date.now() <= REFRESH_MARGIN_MS;
  if (!needsRefresh) return Promise.resolve(session);
  if (!session.refreshToken) {
    clearTokens();
    return Promise.reject(new ChatGptReauthRequiredError('missing_refresh_token'));
  }
  if (!refreshInFlight) {
    const running: Promise<ChatGptSession | null> = refreshSession(session).finally(() => {
      if (refreshInFlight === running) refreshInFlight = null;
    });
    refreshInFlight = running;
  }
  return refreshInFlight;
}

async function refreshSession(session: ChatGptSession): Promise<ChatGptSession | null> {
  const generation = sessionGeneration;
  let tokens: TokenResponse;
  try {
    tokens = await refreshTokens(session.clientId, session.refreshToken!);
  } catch (e) {
    if (generation !== sessionGeneration) return null;
    if (e instanceof OAuthError && isTerminalRefreshError(e.code)) {
      clearTokens();
      throw new ChatGptReauthRequiredError(e.code);
    }
    throw e;
  }
  const {clientId, sub, email, ...previous} = session;
  const next = tokensFromResponse(tokens, previous);
  if (generation !== sessionGeneration) {
    // Signed out (or signed in anew) meanwhile: drop the rotated tokens and revoke them too,
    // since the sign-out revoked the refresh token this refresh had already replaced.
    if (next.refreshToken) revokeRefreshToken(clientId, next.refreshToken).catch(() => undefined);
    return null;
  }
  writeJson(TOKENS_KEY, next);
  return {clientId, sub, email, ...next};
}

/**
 * Revokes the refresh token remotely (best effort) and clears the local tokens.
 * The registration (client id + account) is kept so the next sign-in re-authorizes it.
 */
export async function signOut(): Promise<{remoteRevoked: boolean}> {
  const session = loadSession();
  // Clear first, so a refresh that completes during the revocation cannot write its tokens back.
  clearTokens();
  let remoteRevoked = false;
  if (session?.refreshToken) {
    try {
      await revokeRefreshToken(session.clientId, session.refreshToken);
      remoteRevoked = true;
    } catch {
      remoteRevoked = false;
    }
  }
  return {remoteRevoked};
}
