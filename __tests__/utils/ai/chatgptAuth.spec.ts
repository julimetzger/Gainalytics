import {
  CHATGPT_SCOPES,
  OPENAI_TOKEN_URL,
  buildAuthorizeUrl,
  checkIdToken,
  decodeJwtPayload,
  exchangeCode,
  hasPlanUsageScope,
  isTerminalRefreshError,
  loopbackRedirectUri,
  parseCallback,
} from '../../../app/utils/ai/chatgpt/chatgptAuth';
import {
  buildResponsesBody,
  parseModels,
  parseResponsesStream,
} from '../../../app/utils/ai/chatgpt/chatgptResponses';

const mockFetch = jest.fn();
global.fetch = mockFetch;

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

  it('registers dynamically with the agent name hint on the first sign-in', () => {
    const url = buildAuthorizeUrl(base);

    expect(url.startsWith('https://auth.openai.com/api/accounts/authorize?')).toBe(true);
    expect(query(url)).toEqual({
      client_id: 'dynamic_agent_client',
      agent_name_hint: 'Gainalytics',
      ext_agent_host_id: 'urn:uuid:1234',
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:1455/auth/callback',
      scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: 'https://api.openai.com/v1',
      state: 'st',
      nonce: 'no',
      code_challenge_method: 'S256',
      code_challenge: 'ch',
    });
    expect(CHATGPT_SCOPES).toBe(query(url).scope);
  });

  it('re-authorizes the issued client without agent_name_hint, with id_token_hint and login_hint', () => {
    const url = buildAuthorizeUrl({...base, clientId: 'oaiapp_abc', idTokenHint: 'idt', loginHint: 'a@b.c'});

    expect(query(url)).toEqual({
      client_id: 'oaiapp_abc',
      ext_agent_host_id: 'urn:uuid:1234',
      id_token_hint: 'idt',
      login_hint: 'a@b.c',
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:1455/auth/callback',
      scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',
      resource: 'https://api.openai.com/v1',
      state: 'st',
      nonce: 'no',
      code_challenge_method: 'S256',
      code_challenge: 'ch',
    });
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
    expect(parseCallback('/auth/callback?code=c1&state=evil', 'st')).toEqual({
      ok: false,
      error: 'state_mismatch',
      description: 'OAuth state did not match — ignored.',
    });
  });

  it('surfaces access_denied', () => {
    expect(parseCallback('/auth/callback?error=access_denied&state=st', 'st')).toEqual({
      ok: false,
      error: 'access_denied',
      description: undefined,
    });
  });

  it('rejects a different client id on re-authorization', () => {
    expect(parseCallback('/auth/callback?code=c&state=st&client_id=oaiapp_other', 'st', 'oaiapp_mine')).toEqual({
      ok: false,
      error: 'client_id_mismatch',
    });
  });
});

describe('exchangeCode', () => {
  it('posts a form-encoded authorization_code grant without a client secret', async () => {
    mockFetch.mockResolvedValue({ok: true, status: 200, text: () => Promise.resolve('{"access_token":"at","scope":"openid"}')});

    const tokens = await exchangeCode({clientId: 'oaiapp_x', code: 'c', codeVerifier: 'v', redirectUri: 'http://127.0.0.1:1455/auth/callback'});

    expect(tokens).toEqual({access_token: 'at', scope: 'openid'});
    expect(mockFetch).toHaveBeenCalledWith(OPENAI_TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
      body:
        'grant_type=authorization_code&client_id=oaiapp_x&code=c&code_verifier=v' +
        '&redirect_uri=http%3A%2F%2F127.0.0.1%3A1455%2Fauth%2Fcallback&resource=https%3A%2F%2Fapi.openai.com%2Fv1',
    });
  });

  it('throws an OAuthError with the server error code', async () => {
    mockFetch.mockResolvedValue({ok: false, status: 400, text: () => Promise.resolve('{"error":"invalid_grant","error_description":"bad code"}')});

    await expect(
      exchangeCode({clientId: 'oaiapp_x', code: 'c', codeVerifier: 'v', redirectUri: 'r'}),
    ).rejects.toMatchObject({code: 'invalid_grant', status: 400, message: 'bad code'});
  });
});

describe('refresh error classification', () => {
  it.each(['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused'])(
    '%s is terminal',
    code => expect(isTerminalRefreshError(code)).toBe(true),
  );

  it.each(['http_500', 'http_503', 'temporarily_unavailable', 'invalid_client'])('%s keeps the sign-in', code =>
    expect(isTerminalRefreshError(code)).toBe(false),
  );
});

describe('id token + scopes', () => {
  const token = `h.${b64url({iss: 'https://auth.openai.com', aud: 'oaiapp_x', nonce: 'n1', sub: 'user-1', email: 'ä@example.com'})}.s`;

  it('decodes UTF-8 payloads', () => {
    expect(decodeJwtPayload(token)).toEqual({
      iss: 'https://auth.openai.com',
      aud: 'oaiapp_x',
      nonce: 'n1',
      sub: 'user-1',
      email: 'ä@example.com',
    });
  });

  it('accepts matching iss/aud/nonce and rejects a wrong nonce or audience', () => {
    expect(checkIdToken(token, 'oaiapp_x', 'n1')).toEqual({ok: true, sub: 'user-1', email: 'ä@example.com'});
    expect(checkIdToken(token, 'oaiapp_x', 'other')).toEqual({ok: false, reason: 'nonce mismatch'});
    expect(checkIdToken(token, 'oaiapp_y', 'n1')).toEqual({ok: false, reason: 'aud does not match client id'});
  });

  it('only reports plan usage when chatgpt.tokens.use.direct was granted', () => {
    expect(hasPlanUsageScope('openid profile chatgpt.tokens.use.direct')).toBe(true);
    expect(hasPlanUsageScope('openid profile email')).toBe(false);
    expect(hasPlanUsageScope(undefined)).toBe(false);
  });
});

describe('Responses wire format (plan usage)', () => {
  it('sends the whole conversation with store:false, stream:true and nothing forbidden', () => {
    expect(
      buildResponsesBody('gpt-x', 'be brief', [
        {role: 'user', content: 'Squat 5x5?'},
        {role: 'assistant', content: 'Yes.'},
        {role: 'user', content: 'And rest?'},
      ]),
    ).toEqual({
      model: 'gpt-x',
      instructions: 'be brief',
      input: [
        {type: 'message', role: 'user', content: [{type: 'input_text', text: 'Squat 5x5?'}]},
        {type: 'message', role: 'assistant', content: [{type: 'output_text', text: 'Yes.'}]},
        {type: 'message', role: 'user', content: [{type: 'input_text', text: 'And rest?'}]},
      ],
      store: false,
      stream: true,
    });
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
    expect(parseResponsesStream(sse)).toEqual({ok: true, text: 'Rest 3-5 min.', truncated: false});
    expect(parseResponsesStream('data: {"type":"response.output_text.delta","delta":"Rest"}\n')).toEqual({
      ok: false,
      code: 'stream_interrupted',
      message: 'The answer stream ended unexpectedly.',
    });
  });

  it('keeps the text of an incomplete response and marks it truncated', () => {
    const sse =
      'data: {"type":"response.output_text.delta","delta":"Rest 3 min."}\n' +
      'data: {"type":"response.incomplete","response":{"incomplete_details":{"reason":"max_output_tokens"}}}\n';
    expect(parseResponsesStream(sse)).toEqual({ok: true, text: 'Rest 3 min.', truncated: true});
  });

  it('reports response.failed with its error code', () => {
    const sse = 'data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"limit"}}}\n';
    expect(parseResponsesStream(sse)).toEqual({ok: false, code: 'subscription_sharing_usage_limit_exceeded', message: 'limit'});
  });

  it('lists only models meant to be shown', () => {
    expect(
      parseModels({data: [{slug: 'gpt-a', visibility: 'list'}, {slug: 'gpt-hidden', visibility: 'hide'}, {id: 'gpt-b'}, {foo: 1}]}),
    ).toEqual([{slug: 'gpt-a'}, {slug: 'gpt-b'}]);
  });
});
