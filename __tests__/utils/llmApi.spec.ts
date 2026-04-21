import {DEFAULT_ANTHROPIC_MODEL, callAnthropicClaude, validateAnthropicApiKey} from '../../app/utils/llmApi';

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
    expect(result).toEqual({ok: true, text: 'Keep pushing!'});
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
