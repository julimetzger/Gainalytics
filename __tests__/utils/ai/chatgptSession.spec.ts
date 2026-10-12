/**
 * GH-504: sign-in, refresh and sign-out of the ChatGPT session.
 */
const mockStore = new Map<string, string>();
const mockLoopback = {
  randomToken: jest.fn(),
  randomUuid: jest.fn(() => Promise.resolve('uuid-1')),
  createPkce: jest.fn(() => Promise.resolve({verifier: 'v', challenge: 'c'})),
  start: jest.fn(() => Promise.resolve(1455)),
  awaitCallback: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
};
const mockOpenURL = jest.fn(() => Promise.resolve());

jest.mock('react-native', () => ({
  NativeModules: {ChatGptLoopback: mockLoopback},
  Linking: {openURL: mockOpenURL},
}));
jest.mock('../../../app/utils/secureStorage', () => ({
  getSecureStore: () => ({
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => mockStore.set(k, v),
    delete: (k: string) => mockStore.delete(k),
  }),
}));

// require (not import) so the module reads NativeModules after the mocks above are initialised.
const {
  ChatGptReauthRequiredError,
  getFreshSession,
  loadRegistration,
  loadSession,
  signInWithChatGpt,
  signOut,
  subscribeToChatGptSession,
} = require('../../../app/utils/ai/chatgpt/chatgptSession');

const mockFetch = jest.fn();
global.fetch = mockFetch;

const NOW = 1_800_000_000_000;

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function idToken(clientId: string, nonce: string): string {
  return `h.${b64url({iss: 'https://auth.openai.com', aud: clientId, nonce, sub: 'u1', email: 'a@b.c'})}.s`;
}

function jsonResponse(status: number, body: object) {
  return Promise.resolve({ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body))});
}

function storeSession(expiresAt: number, refreshToken = 'rt-old') {
  mockStore.set('chatgpt_registration', JSON.stringify({clientId: 'oaiapp_x', sub: 'u1', email: 'a@b.c'}));
  mockStore.set(
    'chatgpt_tokens',
    JSON.stringify({accessToken: 'at-old', refreshToken, idToken: 'idt-old', scope: 'openid chatgpt.tokens.use.direct', expiresAt, planUsage: true}),
  );
}

function authorizeQuery(): Record<string, string> {
  const url: string = (mockOpenURL.mock.calls as unknown as string[][])[0][0];
  return Object.fromEntries(url.split('?')[1].split('&').map(p => p.split('=').map(decodeURIComponent)));
}

beforeEach(() => {
  mockStore.clear();
  mockFetch.mockReset();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockLoopback.randomToken.mockReset();
  mockLoopback.randomToken.mockResolvedValueOnce('st').mockResolvedValueOnce('n1');
  mockLoopback.awaitCallback.mockResolvedValue(
    '/auth/callback?code=c1&state=st&client_id=oaiapp_x&scope=openid%20chatgpt.tokens.use.direct',
  );
});

afterEach(() => jest.restoreAllMocks());

describe('signInWithChatGpt', () => {
  it('stores registration and tokens separately and stops the keep-alive only after the exchange', async () => {
    mockFetch.mockImplementation(() => {
      expect(mockLoopback.stop).not.toHaveBeenCalled();
      return jsonResponse(200, {access_token: 'at', refresh_token: 'rt', id_token: idToken('oaiapp_x', 'n1'), scope: 'openid chatgpt.tokens.use.direct', expires_in: 3600});
    });
    const listener = jest.fn();
    const unsubscribe = subscribeToChatGptSession(listener);

    const session = await signInWithChatGpt(() => {});
    unsubscribe();

    expect(session).toEqual({
      clientId: 'oaiapp_x',
      sub: 'u1',
      email: 'a@b.c',
      accessToken: 'at',
      refreshToken: 'rt',
      idToken: idToken('oaiapp_x', 'n1'),
      scope: 'openid chatgpt.tokens.use.direct',
      expiresAt: NOW + 3_600_000,
      planUsage: true,
    });
    expect(loadSession()).toEqual(session);
    expect(JSON.parse(mockStore.get('chatgpt_registration')!)).toEqual({clientId: 'oaiapp_x', sub: 'u1', email: 'a@b.c'});
    expect(mockLoopback.stop).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists the issued client id before the exchange, so a failed exchange is retried with it', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(400, {error: 'invalid_grant'}));

    await expect(signInWithChatGpt(() => {})).rejects.toMatchObject({code: 'invalid_grant'});
    expect(mockLoopback.stop).toHaveBeenCalledTimes(1);
    expect(loadSession()).toBeNull();
    expect(loadRegistration()).toEqual({clientId: 'oaiapp_x'});

    // Second attempt re-authorizes the issued client instead of registering a new one.
    mockOpenURL.mockClear();
    mockLoopback.randomToken.mockResolvedValueOnce('st').mockResolvedValueOnce('n1');
    mockFetch.mockReturnValueOnce(jsonResponse(200, {access_token: 'at', id_token: idToken('oaiapp_x', 'n1'), scope: 'openid chatgpt.tokens.use.direct'}));
    await signInWithChatGpt(() => {});
    expect(authorizeQuery().client_id).toBe('oaiapp_x');
    expect(authorizeQuery().agent_name_hint).toBeUndefined();
  });

  it('a double tap joins the running sign-in instead of starting a second listener', async () => {
    let resolveCallback: (target: string) => void = () => {};
    mockLoopback.awaitCallback.mockReturnValue(new Promise(r => (resolveCallback = r)));
    mockFetch.mockReturnValue(jsonResponse(200, {access_token: 'at', id_token: idToken('oaiapp_x', 'n1'), scope: 'openid chatgpt.tokens.use.direct'}));

    const first = signInWithChatGpt(() => {});
    const second = signInWithChatGpt(() => {});
    await new Promise(r => setTimeout(r, 0));
    resolveCallback('/auth/callback?code=c1&state=st&client_id=oaiapp_x');

    expect(await second).toEqual(await first);
    expect(mockLoopback.start).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledTimes(1);
  });
});

describe('getFreshSession', () => {
  it('returns the stored session untouched while the token is valid', async () => {
    storeSession(NOW + 10 * 60_000);

    expect(await getFreshSession()).toEqual(loadSession());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('serializes concurrent refreshes into one request with the rotating refresh token', async () => {
    storeSession(NOW + 30_000);
    mockFetch.mockReturnValue(jsonResponse(200, {access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600}));

    const [a, b] = await Promise.all([getFreshSession(), getFreshSession()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1].body).toBe(
      'grant_type=refresh_token&client_id=oaiapp_x&refresh_token=rt-old&resource=https%3A%2F%2Fapi.openai.com%2Fv1',
    );
    expect(a).toEqual(b);
    expect(loadSession()).toEqual({
      clientId: 'oaiapp_x',
      sub: 'u1',
      email: 'a@b.c',
      accessToken: 'at-new',
      refreshToken: 'rt-new',
      idToken: 'idt-old',
      scope: 'openid chatgpt.tokens.use.direct',
      expiresAt: NOW + 3_600_000,
      planUsage: true,
    });
  });

  it('clears the tokens but keeps the registration after a terminal refresh error', async () => {
    storeSession(NOW - 1);
    mockFetch.mockReturnValue(jsonResponse(400, {error: 'refresh_token_reused'}));

    await expect(getFreshSession()).rejects.toBeInstanceOf(ChatGptReauthRequiredError);
    expect(loadSession()).toBeNull();
    expect(loadRegistration()).toEqual({clientId: 'oaiapp_x', sub: 'u1', email: 'a@b.c'});
  });

  it('keeps the sign-in when the refresh fails with a server or network error', async () => {
    storeSession(NOW - 1);
    mockFetch.mockReturnValueOnce(jsonResponse(503, {error: 'temporarily_unavailable'}));
    await expect(getFreshSession()).rejects.toMatchObject({code: 'temporarily_unavailable'});

    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(getFreshSession()).rejects.toThrow('Network request failed');

    expect(loadSession()?.refreshToken).toBe('rt-old');
  });
});

describe('signOut', () => {
  it('revokes the refresh token, clears the tokens and keeps the client mapping', async () => {
    storeSession(NOW + 10 * 60_000);
    mockFetch.mockReturnValue(Promise.resolve({ok: true, status: 200}));

    expect(await signOut()).toEqual({remoteRevoked: true});
    expect(mockFetch.mock.calls[0][1].body).toBe('client_id=oaiapp_x&token=rt-old&token_type_hint=refresh_token');
    expect(loadSession()).toBeNull();
    expect(loadRegistration()).toEqual({clientId: 'oaiapp_x', sub: 'u1', email: 'a@b.c'});
  });

  it('a refresh that finishes after sign-out does not bring the old sign-in back', async () => {
    storeSession(NOW - 1);
    let finishRefresh!: () => void;
    mockFetch.mockImplementation((url: string) =>
      url.includes('/oauth/token')
        ? new Promise(resolve => {
            finishRefresh = () => resolve(jsonResponse(200, {access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600}));
          }).then(r => r)
        : Promise.resolve({ok: true, status: 200}),
    );

    const refreshing = getFreshSession();
    await signOut();
    finishRefresh();

    expect(await refreshing).toBeNull();
    expect(loadSession()).toBeNull();
    expect(mockStore.has('chatgpt_tokens')).toBe(false);
    // The rotated refresh token is revoked as well, not just the one sign-out saw.
    await Promise.resolve();
    const revoked = mockFetch.mock.calls.filter(([, init]) => String(init?.body).startsWith('client_id=')).map(([, init]) => init.body);
    expect(revoked).toEqual([
      'client_id=oaiapp_x&token=rt-old&token_type_hint=refresh_token',
      'client_id=oaiapp_x&token=rt-new&token_type_hint=refresh_token',
    ]);
  });

  it('still signs out locally when revocation fails', async () => {
    storeSession(NOW + 10 * 60_000);
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    expect(await signOut()).toEqual({remoteRevoked: false});
    expect(loadSession()).toBeNull();
  });
});

describe('PoC session migration', () => {
  it('keeps a sign-in made with the PoC build', () => {
    mockStore.set('chatgpt_poc_host_id', 'urn:uuid:poc');
    mockStore.set(
      'chatgpt_poc_session',
      JSON.stringify({clientId: 'oaiapp_x', sub: 'u1', email: 'a@b.c', accessToken: 'at', refreshToken: 'rt', scope: 's', expiresAt: 5, planUsage: true}),
    );

    expect(loadSession()).toEqual({clientId: 'oaiapp_x', sub: 'u1', email: 'a@b.c', accessToken: 'at', refreshToken: 'rt', scope: 's', expiresAt: 5, planUsage: true});
    expect(mockStore.get('chatgpt_host_id')).toBe('urn:uuid:poc');
    expect(mockStore.has('chatgpt_poc_session')).toBe(false);
  });
});
