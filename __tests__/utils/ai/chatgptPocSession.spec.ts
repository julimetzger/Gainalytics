/**
 * GH-504: the native loopback keep-alive (foreground service) must stay on until the token
 * exchange has finished — otherwise Android freezes the backgrounded app and sign-in hangs.
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
const {loadSession, signInWithChatGpt} = require('../../../app/utils/ai/chatgptPoc/chatgptSession');

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

beforeEach(() => {
  mockStore.clear();
  mockFetch.mockReset();
  jest.clearAllMocks();
  mockLoopback.randomToken.mockResolvedValueOnce('st').mockResolvedValueOnce('n1');
  mockLoopback.awaitCallback.mockResolvedValue(
    '/auth/callback?code=c1&state=st&client_id=oaiapp_x&scope=openid%20chatgpt.tokens.use.direct',
  );
});

describe('signInWithChatGpt keep-alive', () => {
  it('stops the loopback keep-alive only after the token exchange completed', async () => {
    const idToken = `h.${b64url({iss: 'https://auth.openai.com', aud: 'oaiapp_x', nonce: 'n1', sub: 'u1', email: 'a@b.c'})}.s`;
    mockFetch.mockImplementation(() => {
      expect(mockLoopback.stop).not.toHaveBeenCalled();
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({access_token: 'at', id_token: idToken, scope: 'openid chatgpt.tokens.use.direct'})),
      });
    });

    const session = await signInWithChatGpt(() => {});

    expect(session).toMatchObject({clientId: 'oaiapp_x', email: 'a@b.c', planUsage: true});
    expect(loadSession()?.clientId).toBe('oaiapp_x');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockLoopback.stop).toHaveBeenCalledTimes(1);
  });

  it('also stops the keep-alive when the exchange fails', async () => {
    mockFetch.mockResolvedValue({ok: false, status: 400, text: () => Promise.resolve('{"error":"invalid_grant"}')});

    await expect(signInWithChatGpt(() => {})).rejects.toMatchObject({code: 'invalid_grant'});
    expect(mockLoopback.stop).toHaveBeenCalledTimes(1);
    expect(loadSession()).toBeNull();
  });
});
