import {
  CHATGPT_SCOPES,
  DYNAMIC_CLIENT_ID,
  OPENAI_TOKEN_URL,
  buildAuthorizeUrl,
  checkIdToken,
  decodeJwtPayload,
  exchangeCode,
  hasPlanUsageScope,
  loopbackRedirectUri,
  parseCallback,
} from '../../../app/utils/ai/chatgptPoc/chatgptAuth';
import {
  askChatGpt,
  buildResponsesBody,
  parseResponsesStream,
} from '../../../app/utils/ai/chatgptPoc/chatgptResponses';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

beforeEach(() => mockFetch.mockReset());

function query(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  url
    .split('?')[1]
    .split('&')
    .forEach(p => {
      const [k, v] = p.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  return out;
}

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('buildAuthorizeUrl', () => {
  const base = {
    hostId: 'urn:uuid:1234',
    redirectUri: loopbackRedirectUri(1455),
    state: 'st',
    nonce: 'no',
    codeChallenge: 'ch',
  };

  it('uses dynamic registration with agent name hint on first sign-in', () => {
    const q = query(buildAuthorizeUrl(base));
    expect(q.client_id).toBe(DYNAMIC_CLIENT_ID);
    expect(q.agent_name_hint).toBe('Gainalytics');
    expect(q.redirect_uri).toBe('http://127.0.0.1:1455/auth/callback');
    expect(q.scope).toBe(CHATGPT_SCOPES);
    expect(q.scope).toContain('chatgpt.tokens.use.direct');
    expect(q.resource).toBe('https://api.openai.com/v1');
    expect(q.code_challenge_method).toBe('S256');
    expect(q.ext_agent_host_id).toBe('urn:uuid:1234');
    expect(q.id_token_hint).toBeUndefined();
  });

  it('reuses the issued client id and omits agent_name_hint on reauthorization', () => {
    const q = query(buildAuthorizeUrl({...base, clientId: 'oaiapp_abc', idTokenHint: 'idt'}));
    expect(q.client_id).toBe('oaiapp_abc');
    expect(q.agent_name_hint).toBeUndefined();
    expect(q.id_token_hint).toBe('idt');
  });
});

describe('parseCallback', () => {
  it('returns code and issued client id when state matches', () => {
    expect(parseCallback('/auth/callback?code=c1&state=st&client_id=oaiapp_x&scope=openid%20chatgpt.tokens.use.direct', 'st')).toEqual({
      ok: true,
      code: 'c1',
      clientId: 'oaiapp_x',
      scope: 'openid chatgpt.tokens.use.direct',
    });
  });

  it('rejects a state mismatch before looking at the code', () => {
    const r = parseCallback('/auth/callback?code=c1&state=evil', 'st');
    expect(r).toMatchObject({ok: false, error: 'state_mismatch'});
  });

  it('surfaces access_denied', () => {
    expect(parseCallback('/auth/callback?error=access_denied&state=st', 'st')).toMatchObject({ok: false, error: 'access_denied'});
  });

  it('rejects a different client id on reauthorization', () => {
    expect(parseCallback('/auth/callback?code=c&state=st&client_id=oaiapp_other', 'st', 'oaiapp_mine')).toMatchObject({
      ok: false,
      error: 'client_id_mismatch',
    });
  });
});

describe('exchangeCode', () => {
  it('posts a form-encoded authorization_code grant without a client secret', async () => {
    mockFetch.mockResolvedValue({ok: true, status: 200, text: () => Promise.resolve('{"access_token":"at","scope":"openid"}')});
    const tokens = await exchangeCode({clientId: 'oaiapp_x', code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:1455/auth/callback'});
    expect(tokens.access_token).toBe('at');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(OPENAI_TOKEN_URL);
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.body).toContain('grant_type=authorization_code');
    expect(init.body).toContain('code_verifier=v');
    expect(init.body).toContain('resource=https%3A%2F%2Fapi.openai.com%2Fv1');
    expect(init.body).not.toContain('client_secret');
  });

  it('throws an OAuthError with the server error code', async () => {
    mockFetch.mockResolvedValue({ok: false, status: 400, text: () => Promise.resolve('{"error":"invalid_grant","error_description":"bad code"}')});
    await expect(
      exchangeCode({clientId: 'oaiapp_x', code: 'c', codeVerifier: 'v', redirectUri: 'r'}),
    ).rejects.toMatchObject({code: 'invalid_grant', status: 400});
  });
});

describe('id token + scopes', () => {
  const token = `h.${b64url({iss: 'https://auth.openai.com', aud: 'oaiapp_x', nonce: 'n1', sub: 'user-1', email: 'ä@example.com'})}.s`;

  it('decodes UTF-8 payloads', () => {
    expect(decodeJwtPayload(token)?.email).toBe('ä@example.com');
  });

  it('accepts matching iss/aud/nonce and rejects a wrong nonce', () => {
    expect(checkIdToken(token, 'oaiapp_x', 'n1')).toMatchObject({ok: true, sub: 'user-1'});
    expect(checkIdToken(token, 'oaiapp_x', 'other')).toMatchObject({ok: false, reason: 'nonce mismatch'});
    expect(checkIdToken(token, 'oaiapp_y', 'n1')).toMatchObject({ok: false});
  });

  it('only reports plan usage when chatgpt.tokens.use.direct was granted', () => {
    expect(hasPlanUsageScope('openid profile chatgpt.tokens.use.direct')).toBe(true);
    expect(hasPlanUsageScope('openid profile email')).toBe(false);
    expect(hasPlanUsageScope(undefined)).toBe(false);
  });
});

describe('Responses API (plan usage)', () => {
  it('builds a body with store:false, stream:true and no forbidden fields', () => {
    const body: any = buildResponsesBody('gpt-x', 'be brief', 'hi');
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.instructions).toBe('be brief');
    for (const forbidden of ['temperature', 'max_output_tokens', 'metadata', 'user', 'previous_response_id']) {
      expect(body).not.toHaveProperty(forbidden);
    }
    expect(JSON.stringify(body.input)).not.toContain('"system"');
  });

  it('assembles text from output_text deltas and requires response.completed', () => {
    const sse = [
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"Rest "}',
      '',
      'data: {"type":"response.output_text.delta","delta":"3-5 min."}',
      '',
      'data: {"type":"response.completed","response":{"model":"gpt-x"}}',
      '',
    ].join('\n');
    expect(parseResponsesStream(sse)).toEqual({ok: true, text: 'Rest 3-5 min.', model: 'gpt-x'});
    expect(parseResponsesStream('data: {"type":"response.output_text.delta","delta":"Rest"}\n')).toMatchObject({
      ok: false,
      code: 'stream_interrupted',
    });
  });

  it('maps response.failed usage-limit errors', () => {
    const sse = 'data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"limit"}}}\n';
    expect(parseResponsesStream(sse)).toMatchObject({ok: false, code: 'subscription_sharing_usage_limit_exceeded'});
  });

  it('sends the access token as bearer and maps structured HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"error":{"code":"subscription_sharing_user_not_eligible","message":"no plan"}}'),
    });
    const r = await askChatGpt('tok', 'gpt-x', 'i', 'q');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(r).toEqual({ok: false, code: 'subscription_sharing_user_not_eligible', message: 'no plan', status: 403});
  });
});
