import {
  DEFAULT_ANTHROPIC_MODEL,
  INSIGHT_REQUEST_TIMEOUT_MS,
  callAnthropicClaude,
  validateAnthropicApiKey,
} from '../../app/utils/llmApi';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function makeOkResponse(text: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({content: [{text}]}),
    text: () => Promise.resolve(text),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DEFAULT_ANTHROPIC_MODEL', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_ANTHROPIC_MODEL).toBe('string');
    expect(DEFAULT_ANTHROPIC_MODEL.trim().length).toBeGreaterThan(0);
  });
});

describe('callAnthropicClaude', () => {
  it('sends the supplied model in the request body', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse('Great work!'));

    await callAnthropicClaude('sk-key', 'system', 'user', 'claude-opus-4-7');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('claude-opus-4-7');
  });

  it('returns no_key when apiKey is empty', async () => {
    const result = await callAnthropicClaude('', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(result).toEqual({ok: false, error: {type: 'no_key'}});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns invalid_key on 401', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 401});
    const result = await callAnthropicClaude('bad-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(result).toEqual({ok: false, error: {type: 'invalid_key'}});
  });

  it('returns rate_limit on 429', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 429});
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(result).toEqual({ok: false, error: {type: 'rate_limit'}});
  });

  it('returns ok with text on success', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse('Keep pushing!'));
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(result).toEqual({ok: true, text: 'Keep pushing!', truncated: false});
  });

  it('cold-start: persisted custom model reaches the API body — Settings tab never opened', async () => {
    // Simulates: user persisted 'claude-sonnet-4-6-20251001', cold-starts the app,
    // CoachInsightCard fires before Settings is ever opened.
    // With Option B there is no module-level cache; the caller passes the model directly.
    const persistedModel = 'claude-sonnet-4-6-20251001';
    mockFetch.mockReturnValueOnce(makeOkResponse('Looking good!'));

    await callAnthropicClaude('sk-key', 'sys', 'msg', persistedModel);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe(persistedModel);
  });
});

describe('validateAnthropicApiKey', () => {
  it('uses DEFAULT_ANTHROPIC_MODEL for validation calls', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse('OK'));
    await validateAnthropicApiKey('sk-key');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe(DEFAULT_ANTHROPIC_MODEL);
  });
});

/**
 * GH-449: the coach insight was capped at 200 output tokens, so a normal three-sentence answer
 * ran out of budget and stopped at whatever token came next — on screen, a word broken in half.
 */
describe('callAnthropicClaude — truncation (GH-449)', () => {
  function makeStopReasonResponse(text: string, stopReason: string) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({content: [{text}], stop_reason: stopReason}),
      text: () => Promise.resolve(text),
    });
  }

  it('asks for a budget big enough for the three-sentence insight the prompt requests', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse('ok'));
    await callAnthropicClaude('sk-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // The 200-token cap was the root cause; anything at that level truncates again.
    expect(body.max_tokens).toBeGreaterThanOrEqual(1024);
  });

  it('flags a max_tokens stop and ends the text on a whole word', async () => {
    mockFetch.mockReturnValueOnce(
      makeStopReasonResponse('Your quads are progressing while hamst', 'max_tokens'),
    );
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', 'claude-opus-5');
    expect(result).toEqual({
      ok: true,
      text: 'Your quads are progressing while…',
      truncated: true,
    });
  });

  it('returns the answer even when the model reasons first (GH-449, seen on claude-opus-5)', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            content: [
              {type: 'thinking', thinking: 'Chest was trained twice this micro…'},
              {type: 'text', text: 'Chest frequency doubled while back stalled.'},
            ],
            stop_reason: 'end_turn',
          }),
        text: () => Promise.resolve(''),
      }),
    );
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', 'claude-opus-5');
    // Reading content[0].text here produced an insight card with no advice under it.
    expect(result).toEqual({
      ok: true,
      text: 'Chest frequency doubled while back stalled.',
      truncated: false,
    });
  });

  it('leaves a complete answer untouched and unflagged', async () => {
    mockFetch.mockReturnValueOnce(
      makeStopReasonResponse('Squat volume stalled. Add a set.', 'end_turn'),
    );
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(result).toEqual({
      ok: true,
      text: 'Squat volume stalled. Add a set.',
      truncated: false,
    });
  });
});

/**
 * GH-447: the coach insight shares the chat's failure mode — an unanswered call left the card
 * spinning on "Generating insight…" indefinitely.
 */
describe('callAnthropicClaude — a call that never returns (GH-447)', () => {
  function makeHangingResponse() {
    return (_url: string, init: {signal: AbortSignal}) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
  }

  it('bounds an insight request finitely', () => {
    expect(INSIGHT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(Number.isFinite(INSIGHT_REQUEST_TIMEOUT_MS)).toBe(true);
  });

  it('passes an abort signal to fetch', async () => {
    mockFetch.mockReturnValueOnce(makeOkResponse('ok'));
    await callAnthropicClaude('sk-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(mockFetch.mock.calls[0][1].signal).toBeDefined();
  });

  it('resolves to a timeout error carrying the bound it gave up at', async () => {
    mockFetch.mockImplementation(makeHangingResponse());
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', 'claude-opus-5', {
      timeoutMs: 30,
    });
    expect(result).toEqual({ok: false, error: {type: 'timeout', timeoutMs: 30}});
  });

  it('reports a caller cancel as "aborted" rather than as a network error', async () => {
    mockFetch.mockImplementation(makeHangingResponse());
    const controller = new AbortController();
    const pending = callAnthropicClaude('sk-key', 'sys', 'msg', 'claude-opus-5', {
      signal: controller.signal,
      timeoutMs: 60_000,
    });
    controller.abort();
    await expect(pending).resolves.toEqual({ok: false, error: {type: 'aborted'}});
  });

  it('still reports a genuine network failure as a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));
    const result = await callAnthropicClaude('sk-key', 'sys', 'msg', DEFAULT_ANTHROPIC_MODEL);
    expect(result).toEqual({
      ok: false,
      error: {type: 'network', message: 'Network request failed'},
    });
  });
});
