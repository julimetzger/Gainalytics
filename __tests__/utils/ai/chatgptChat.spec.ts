/**
 * GH-504: AI Chat and Coach Insight requests against the ChatGPT plan — happy path and the
 * error cases the user can run into (limit reached, sign-in invalid, not signed in, network).
 */
const mockGetFreshSession = jest.fn();
jest.mock('../../../app/utils/ai/chatgpt/chatgptSession', () => {
  class ChatGptReauthRequiredError extends Error {}
  return {
    ChatGptReauthRequiredError,
    getFreshSession: (...args: unknown[]) => mockGetFreshSession(...args),
  };
});

const {callChatGpt, listChatGptModels, sendChatGptMessage} = require('../../../app/utils/ai/chatgpt/chatgptChat');
const {ChatGptReauthRequiredError} = require('../../../app/utils/ai/chatgpt/chatgptSession');

const mockFetch = jest.fn();
global.fetch = mockFetch;

const SESSION = {clientId: 'oaiapp_x', accessToken: 'at', scope: 's', expiresAt: 0, planUsage: true};
const OK_STREAM =
  'data: {"type":"response.output_text.delta","delta":"Rest 3 min."}\n' +
  'data: {"type":"response.completed","response":{}}\n';

function textResponse(status: number, body: string) {
  return Promise.resolve({ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body)});
}

beforeEach(() => {
  mockFetch.mockReset();
  mockGetFreshSession.mockReset();
  mockGetFreshSession.mockResolvedValue(SESSION);
});

describe('sendChatGptMessage', () => {
  it('sends the whole conversation with the chat prompt as instructions and returns the answer', async () => {
    mockFetch.mockReturnValue(textResponse(200, OK_STREAM));

    const result = await sendChatGptMessage(
      [
        {role: 'user', content: 'Squat 5x5?'},
        {role: 'assistant', content: 'Yes.', hadContext: true},
        {role: 'user', content: 'And rest?'},
      ],
      'Coach. Analysis context: {}',
      'gpt-x',
    );

    expect(result).toEqual({ok: true, text: 'Rest 3 min.', hadContext: true, truncated: false});
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.headers).toEqual({Authorization: 'Bearer at', 'Content-Type': 'application/json', Accept: 'text/event-stream'});
    expect(JSON.parse(init.body)).toEqual({
      model: 'gpt-x',
      instructions: 'Coach. Analysis context: {}',
      input: [
        {type: 'message', role: 'user', content: [{type: 'input_text', text: 'Squat 5x5?'}]},
        {type: 'message', role: 'assistant', content: [{type: 'output_text', text: 'Yes.'}]},
        {type: 'message', role: 'user', content: [{type: 'input_text', text: 'And rest?'}]},
      ],
      store: false,
      stream: true,
    });
  });

  it('uses the first model of the plan when none is chosen', async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({data: [{slug: 'gpt-first'}, {slug: 'gpt-second'}]})}))
      .mockReturnValueOnce(textResponse(200, OK_STREAM));

    await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', undefined);

    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).model).toBe('gpt-first');
  });

  it('reports a reached usage limit in plain words', async () => {
    mockFetch.mockReturnValue(
      textResponse(429, '{"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"limit"}}'),
    );

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x')).toEqual({
      ok: false,
      kind: 'error',
      error:
        'Your ChatGPT usage limit for Gainalytics is reached. Check your usage in ChatGPT (Settings → Usage) or try again later.',
    });
  });

  it('refreshes once on a 401 and repeats the request with the new token', async () => {
    mockGetFreshSession.mockResolvedValueOnce(SESSION).mockResolvedValueOnce({...SESSION, accessToken: 'at-new'});
    mockFetch.mockReturnValueOnce(textResponse(401, '{"detail":"expired"}')).mockReturnValueOnce(textResponse(200, OK_STREAM));

    const result = await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x');

    expect(result).toEqual({ok: true, text: 'Rest 3 min.', hadContext: false, truncated: false});
    expect(mockGetFreshSession.mock.calls).toEqual([[{force: false}], [{force: true}]]);
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer at-new');
  });

  it('asks to sign in again when the sign-in cannot be refreshed any more', async () => {
    mockGetFreshSession.mockRejectedValue(new ChatGptReauthRequiredError('invalid_grant'));

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x')).toEqual({
      ok: false,
      kind: 'error',
      error: 'Your ChatGPT sign-in has expired. Sign in again under Settings → AI Coach.',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('says so when ChatGPT still rejects the refreshed sign-in', async () => {
    mockFetch.mockReturnValue(textResponse(401, '{"error":{"code":"subscription_sharing_invalid_user","message":"invalid user"}}'));

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x')).toEqual({
      ok: false,
      kind: 'error',
      error: 'ChatGPT did not accept your sign-in (invalid user). Sign in again under Settings → AI Coach.',
    });
  });

  it('is a no_key failure when nobody is signed in', async () => {
    mockGetFreshSession.mockResolvedValue(null);

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x')).toEqual({
      ok: false,
      kind: 'no_key',
      error: 'Not signed in to ChatGPT. Sign in under Settings → AI Coach.',
    });
  });

  it('explains a missing plan-usage grant', async () => {
    mockGetFreshSession.mockResolvedValue({...SESSION, planUsage: false});

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x')).toEqual({
      ok: false,
      kind: 'error',
      error:
        'Gainalytics was not allowed to use your ChatGPT plan. Sign in again under Settings → AI Coach and allow plan usage.',
    });
  });

  it('reports network errors and keeps the sign-in', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x')).toEqual({
      ok: false,
      kind: 'error',
      error: 'Network error: Network request failed',
    });
  });

  it('is an aborted failure when the user presses Stop', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementation((_url: string, init: {signal: AbortSignal}) => {
      controller.abort();
      expect(init.signal.aborted).toBe(true);
      return Promise.reject(new Error('Aborted'));
    });

    expect(await sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x', {signal: controller.signal})).toEqual({
      ok: false,
      kind: 'aborted',
      error: 'Request cancelled.',
    });
  });

  it('is a timeout failure when ChatGPT does not answer in time', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, init: {signal: AbortSignal}) =>
        new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('Aborted')))),
    );

    const pending = sendChatGptMessage([{role: 'user', content: 'hi'}], 'sys', 'gpt-x', {timeoutMs: 5000});
    await jest.advanceTimersByTimeAsync(5000);

    expect(await pending).toEqual({
      ok: false,
      kind: 'timeout',
      error: 'ChatGPT did not answer within 5s. Check your connection, or try a faster model in Settings.',
    });
    jest.useRealTimers();
  });
});

describe('callChatGpt (Coach Insight)', () => {
  it('returns the insight text', async () => {
    mockFetch.mockReturnValue(textResponse(200, OK_STREAM));

    expect(await callChatGpt('sys', 'data', 'gpt-x')).toEqual({ok: true, text: 'Rest 3 min.', truncated: false});
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).input).toEqual([
      {type: 'message', role: 'user', content: [{type: 'input_text', text: 'data'}]},
    ]);
  });

  it('hides the card (no_key) when not signed in and words other failures for the card', async () => {
    mockGetFreshSession.mockResolvedValueOnce(null);
    expect(await callChatGpt('sys', 'data', 'gpt-x')).toEqual({ok: false, error: {type: 'no_key'}});

    mockFetch.mockReturnValue(textResponse(503, '{"error":{"code":"subscription_sharing_usage_unavailable","message":"x"}}'));
    expect(await callChatGpt('sys', 'data', 'gpt-x')).toEqual({
      ok: false,
      error: {type: 'provider_error', message: 'ChatGPT could not check your plan usage right now. Try again in a few minutes.'},
    });
  });
});

describe('listChatGptModels', () => {
  it('returns the plan models or a readable error', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({data: [{slug: 'gpt-a'}]})}));
    expect(await listChatGptModels()).toEqual({ok: true, models: [{slug: 'gpt-a'}]});

    mockGetFreshSession.mockRejectedValueOnce(new ChatGptReauthRequiredError('invalid_grant'));
    expect(await listChatGptModels()).toEqual({
      ok: false,
      message: 'Your ChatGPT sign-in has expired. Sign in again under Settings → AI Coach.',
    });
  });
});
