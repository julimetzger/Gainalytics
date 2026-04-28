import {sendChatMessage, ChatMessage} from '../../../app/utils/ai/sendChatMessage';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function makeOkResponse(text: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({content: [{type: 'text', text}]}),
    text: () => Promise.resolve(''),
  } as Response);
}

function makeErrorResponse(status: number, body = 'error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('sendChatMessage', () => {
  it('returns ok:false when apiKey is empty', async () => {
    const result = await sendChatMessage([], '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('No API key');
  });

  it('sends messages array and returns assistant text on success', async () => {
    mockFetch.mockReturnValue(makeOkResponse('Great training!'));
    const msgs: ChatMessage[] = [{role: 'user', content: 'How did I do?'}];
    const result = await sendChatMessage(msgs, 'sk-test-key');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe('Great training!');
  });

  it('returns invalid_key error on 401', async () => {
    mockFetch.mockReturnValue(makeErrorResponse(401));
    const result = await sendChatMessage([{role: 'user', content: 'hi'}], 'bad-key');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Invalid API key');
  });

  it('returns rate_limit error on 429', async () => {
    mockFetch.mockReturnValue(makeErrorResponse(429));
    const result = await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('rate limit');
  });

  it('includes system prompt when provided', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key', 'You are a coach.');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('You are a coach.');
  });

  it('does not include system field when no system prompt', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBeUndefined();
  });

  it('full-history invariant: after 3 turns, 4th request sends 7 messages total', async () => {
    // Simulate 3 completed turns, then a 4th user message.
    // The caller is responsible for passing the full history; we verify the payload.
    const history: ChatMessage[] = [
      {role: 'assistant', content: 'context seed'},
      {role: 'user', content: 'turn 1'},
      {role: 'assistant', content: 'response 1'},
      {role: 'user', content: 'turn 2'},
      {role: 'assistant', content: 'response 2'},
      {role: 'user', content: 'turn 3'},
      {role: 'assistant', content: 'response 3'},
      // 4th user message appended by AIChatTab before calling sendChatMessage
      {role: 'user', content: 'turn 4'},
    ];

    mockFetch.mockReturnValue(makeOkResponse('response 4'));
    await sendChatMessage(history, 'sk-key');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // All 8 messages must appear in the request
    expect(body.messages).toHaveLength(8);
    expect(body.messages[0]).toEqual({role: 'assistant', content: 'context seed'});
    expect(body.messages[7]).toEqual({role: 'user', content: 'turn 4'});
  });

  it('full-history invariant: 3 user + 3 assistant + 1 new user = 7 messages', async () => {
    // Ticket requirement: after 3 turns, 4th request has 6 prior messages + 1 new = 7
    const prior: ChatMessage[] = [
      {role: 'user', content: 'u1'},
      {role: 'assistant', content: 'a1'},
      {role: 'user', content: 'u2'},
      {role: 'assistant', content: 'a2'},
      {role: 'user', content: 'u3'},
      {role: 'assistant', content: 'a3'},
    ];
    const newMsg: ChatMessage = {role: 'user', content: 'u4'};
    const fullHistory = [...prior, newMsg];

    mockFetch.mockReturnValue(makeOkResponse('a4'));
    await sendChatMessage(fullHistory, 'sk-key');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(7);
    expect(body.messages[6]).toEqual(newMsg);
  });

  it('returns network error on fetch throw', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));
    const result = await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Network error');
  });

  it('system prompt includes seedContextJson when composed by caller', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    const seedJson = JSON.stringify({meso_name: 'Hypertrophy', sessions: [{date: '2026-04-01', exercises: []}]});
    const basePrompt = 'You are an AI training coach specializing in powerlifting and strength training. Use the provided analysis context to give specific, actionable advice. Be concise and practical.';
    const composedPrompt = `${basePrompt}\n\nAnalysis context (last 28 days of finished trainings as JSON):\n\n${seedJson}`;

    await sendChatMessage([{role: 'user', content: 'How many sessions?'}], 'sk-key', composedPrompt);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain('Analysis context (last 28 days of finished trainings as JSON):');
    expect(body.system).toContain(seedJson);
  });
});

describe('sendChatMessage – hadContext tracking (GH-168)', () => {
  it('returns hadContext:true when system prompt includes training context', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    const seed = JSON.stringify({sessions: []});
    const systemPrompt = `You are a coach.\n\nAnalysis context (finished trainings as JSON):\n\n${seed}`;
    const result = await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key', systemPrompt);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hadContext).toBe(true);
  });

  it('returns hadContext:false when system prompt has no training context', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    const result = await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key', 'You are a coach.');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hadContext).toBe(false);
  });

  it('returns hadContext:false when no system prompt is provided', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    const result = await sendChatMessage([{role: 'user', content: 'hi'}], 'sk-key');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.hadContext).toBe(false);
  });

  it('strips hadContext from ChatMessage objects before sending to the API', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    const msgs: ChatMessage[] = [
      {role: 'user', content: 'q1'},
      {role: 'assistant', content: 'a1', hadContext: true},
      {role: 'user', content: 'q2'},
    ];
    await sendChatMessage(msgs, 'sk-key');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // API body must contain only role+content — no hadContext field
    expect(body.messages[1]).toEqual({role: 'assistant', content: 'a1'});
    expect(body.messages[1].hadContext).toBeUndefined();
  });

  it('strips hadContext:false from messages before sending to the API', async () => {
    mockFetch.mockReturnValue(makeOkResponse('ok'));
    const msgs: ChatMessage[] = [
      {role: 'user', content: 'q'},
      {role: 'assistant', content: 'r', hadContext: false},
    ];
    await sendChatMessage(msgs, 'sk-key');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[1]).toEqual({role: 'assistant', content: 'r'});
    expect(body.messages[1].hadContext).toBeUndefined();
  });
});
