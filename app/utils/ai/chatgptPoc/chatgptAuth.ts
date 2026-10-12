/**
 * GH-504 PoC — "Sign in with ChatGPT" with ChatGPT plan usage.
 *
 * Follows OpenAI's open-source / locally hosted flow
 * (https://developers.openai.com/siwc/token-sharing-open-source/sign-in):
 * dynamic client registration via `client_id=dynamic_agent_client`, PKCE (S256)
 * and a loopback redirect on 127.0.0.1. Only used by the dev-only PoC screen;
 * the Claude API-key path does not touch this module.
 */

export const OPENAI_AUTHORIZE_URL = 'https://auth.openai.com/api/accounts/authorize';
export const OPENAI_TOKEN_URL = 'https://auth.openai.com/api/accounts/oauth/token';
export const OPENAI_REVOKE_URL = 'https://auth.openai.com/api/accounts/oauth/revoke';
export const OPENAI_ISSUER = 'https://auth.openai.com';
export const OPENAI_RESOURCE = 'https://api.openai.com/v1';
export const DYNAMIC_CLIENT_ID = 'dynamic_agent_client';
export const PLAN_USAGE_SCOPE = 'chatgpt.tokens.use.direct';
export const CHATGPT_SCOPES = `openid profile email offline_access resource.invoke ${PLAN_USAGE_SCOPE}`;
export const LOOPBACK_DEFAULT_PORT = 1455;
export const LOOPBACK_CALLBACK_PATH = '/auth/callback';
export const AGENT_NAME_HINT = 'Gainalytics';

export function loopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${LOOPBACK_CALLBACK_PATH}`;
}

export interface AuthorizeParams {
  /** Issued `oaiapp_…` client id, or undefined for the first registration. */
  clientId?: string;
  hostId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  idTokenHint?: string;
  loginHint?: string;
}

function toQuery(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
}

export function buildAuthorizeUrl(p: AuthorizeParams): string {
  const firstRegistration = !p.clientId;
  return `${OPENAI_AUTHORIZE_URL}?${toQuery({
    client_id: p.clientId ?? DYNAMIC_CLIENT_ID,
    // agent_name_hint is only sent on the initial registration.
    agent_name_hint: firstRegistration ? AGENT_NAME_HINT : undefined,
    ext_agent_host_id: p.hostId,
    id_token_hint: p.idTokenHint,
    login_hint: p.loginHint,
    response_type: 'code',
    redirect_uri: p.redirectUri,
    scope: CHATGPT_SCOPES,
    resource: OPENAI_RESOURCE,
    state: p.state,
    nonce: p.nonce,
    code_challenge_method: 'S256',
    code_challenge: p.codeChallenge,
  })}`;
}

export type CallbackResult =
  | {ok: true; code: string; clientId?: string; scope?: string}
  | {ok: false; error: string; description?: string};

function parseQuery(target: string): Record<string, string> {
  const query = target.includes('?') ? target.slice(target.indexOf('?') + 1) : '';
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/** Parses the loopback request target (`/auth/callback?code=…&state=…`). */
export function parseCallback(
  target: string,
  expectedState: string,
  expectedClientId?: string,
): CallbackResult {
  const q = parseQuery(target);
  if (q.state !== expectedState) {
    return {ok: false, error: 'state_mismatch', description: 'OAuth state did not match — ignored.'};
  }
  if (q.error) {
    return {ok: false, error: q.error, description: q.error_description};
  }
  if (!q.code) {
    return {ok: false, error: 'missing_code'};
  }
  if (expectedClientId && q.client_id && q.client_id !== expectedClientId) {
    return {ok: false, error: 'client_id_mismatch'};
  }
  return {ok: true, code: q.code, clientId: q.client_id, scope: q.scope};
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export class OAuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message);
  }
}

async function postForm(url: string, body: Record<string, string | undefined>): Promise<TokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: toQuery(body),
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body (e.g. Cloudflare HTML) — keep a short excerpt for the error message.
  }
  if (!res.ok) {
    throw new OAuthError(
      json.error ?? `http_${res.status}`,
      json.error_description ?? json.error ?? text.slice(0, 200),
      res.status,
    );
  }
  return json as TokenResponse;
}

export function exchangeCode(args: {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  return postForm(OPENAI_TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: args.clientId,
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
    resource: OPENAI_RESOURCE,
  });
}

export function refreshTokens(clientId: string, refreshToken: string): Promise<TokenResponse> {
  return postForm(OPENAI_TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    resource: OPENAI_RESOURCE,
  });
}

export async function revokeRefreshToken(clientId: string, refreshToken: string): Promise<void> {
  const res = await fetch(OPENAI_REVOKE_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: toQuery({client_id: clientId, token: refreshToken, token_type_hint: 'refresh_token'}),
  });
  if (!res.ok) {
    throw new OAuthError(`http_${res.status}`, `Revocation failed (${res.status})`, res.status);
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of s) {
    const idx = B64.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  // UTF-8 decode
  return decodeURIComponent(bytes.map(b => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

/**
 * Decodes a JWT payload WITHOUT verifying its signature. PoC only — a production
 * implementation must verify against https://auth.openai.com/.well-known/jwks.json.
 */
export function decodeJwtPayload(jwt: string): Record<string, any> | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

export interface IdTokenCheck {
  ok: boolean;
  reason?: string;
  sub?: string;
  email?: string;
}

export function checkIdToken(idToken: string, clientId: string, nonce: string): IdTokenCheck {
  const claims = decodeJwtPayload(idToken);
  if (!claims) return {ok: false, reason: 'id_token not decodable'};
  if (claims.iss !== OPENAI_ISSUER) return {ok: false, reason: `unexpected iss ${claims.iss}`};
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) return {ok: false, reason: 'aud does not match client id'};
  if (claims.nonce !== nonce) return {ok: false, reason: 'nonce mismatch'};
  return {ok: true, sub: claims.sub, email: claims.email};
}

export function hasPlanUsageScope(scope: string | undefined): boolean {
  return (scope ?? '').split(/\s+/).includes(PLAN_USAGE_SCOPE);
}
