import reducer, {
  appendMessage,
  clearChat,
  setError,
  setLoading,
  setSeedContextJson,
  setContextRange,
  startChatWithContext,
  AIChatState,
  ChatSeedContext,
  ContextRange,
} from '../../../app/redux/AIChat/aiChatSlice';

const initial: AIChatState = {
  messages: [],
  isLoading: false,
  error: null,
  seedContextJson: null,
  contextRange: null,
};

describe('aiChatSlice', () => {
  it('starts with empty state', () => {
    expect(reducer(undefined, {type: '@@INIT'})).toEqual(initial);
  });

  it('appendMessage adds a message', () => {
    const state = reducer(initial, appendMessage({role: 'user', content: 'Hello'}));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual({role: 'user', content: 'Hello'});
  });

  it('appendMessage accumulates messages in order', () => {
    let state = reducer(initial, appendMessage({role: 'user', content: 'msg1'}));
    state = reducer(state, appendMessage({role: 'assistant', content: 'resp1'}));
    state = reducer(state, appendMessage({role: 'user', content: 'msg2'}));
    expect(state.messages).toHaveLength(3);
    expect(state.messages[2].content).toBe('msg2');
  });

  it('setLoading sets isLoading', () => {
    const state = reducer(initial, setLoading(true));
    expect(state.isLoading).toBe(true);
  });

  it('setError sets error and clears isLoading', () => {
    const withLoading = {...initial, isLoading: true};
    const state = reducer(withLoading, setError('Something went wrong'));
    expect(state.error).toBe('Something went wrong');
    expect(state.isLoading).toBe(false);
  });

  it('setError(null) clears error', () => {
    const withError = {...initial, error: 'old error'};
    const state = reducer(withError, setError(null));
    expect(state.error).toBeNull();
  });

  it('clearChat resets messages/loading/error/seedContextJson but preserves contextRange', () => {
    const range: ContextRange = {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-28T00:00:00.000Z',
    };
    const state: AIChatState = {
      messages: [{role: 'user', content: 'hi'}, {role: 'assistant', content: 'hello'}],
      isLoading: true,
      error: 'some error',
      seedContextJson: '{"sessions":[]}',
      contextRange: range,
    };
    const result = reducer(state, clearChat());
    expect(result.messages).toHaveLength(0);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.seedContextJson).toBeNull();
    expect(result.contextRange).toEqual(range);
  });

  it('clearChat with null contextRange equals initial state', () => {
    const state: AIChatState = {
      messages: [{role: 'user', content: 'hi'}, {role: 'assistant', content: 'hello'}],
      isLoading: true,
      error: 'some error',
      seedContextJson: '{"sessions":[]}',
      contextRange: null,
    };
    expect(reducer(state, clearChat())).toEqual(initial);
  });

  it('setSeedContextJson updates seedContextJson', () => {
    const json = '{"sessions":[]}';
    const state = reducer(initial, setSeedContextJson(json));
    expect(state.seedContextJson).toBe(json);
  });

  it('setSeedContextJson(null) clears seedContextJson', () => {
    const withJson = {...initial, seedContextJson: '{"sessions":[]}'};
    expect(reducer(withJson, setSeedContextJson(null)).seedContextJson).toBeNull();
  });

  it('setContextRange stores the range', () => {
    const range: ContextRange = {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-28T00:00:00.000Z',
    };
    const state = reducer(initial, setContextRange(range));
    expect(state.contextRange).toEqual(range);
  });

  it('setContextRange(null) clears contextRange', () => {
    const range: ContextRange = {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-28T00:00:00.000Z',
    };
    const withRange = {...initial, contextRange: range};
    expect(reducer(withRange, setContextRange(null)).contextRange).toBeNull();
  });

  it('startChatWithContext seeds conversation with insightText as assistant message', () => {
    const ctx: ChatSeedContext = {
      insightText: 'Here is your analysis: great work!',
      seedContextJson: null,
    };
    let state = reducer(initial, appendMessage({role: 'user', content: 'existing'}));
    state = reducer(state, startChatWithContext(ctx));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual({role: 'assistant', content: 'Here is your analysis: great work!'});
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('startChatWithContext stores seedContextJson in state', () => {
    const seedJson = JSON.stringify({meso_name: 'Hypertrophy', sessions: []});
    const ctx: ChatSeedContext = {insightText: 'Great training!', seedContextJson: seedJson};
    const state = reducer(initial, startChatWithContext(ctx));
    expect(state.seedContextJson).toBe(seedJson);
  });

  it('startChatWithContext with null seedContextJson stores null', () => {
    const ctx: ChatSeedContext = {insightText: 'Insight', seedContextJson: null};
    const state = reducer(initial, startChatWithContext(ctx));
    expect(state.seedContextJson).toBeNull();
  });

  it('startChatWithContext clears previous chat before seeding', () => {
    let state: AIChatState = {
      messages: [{role: 'user', content: 'old msg'}, {role: 'assistant', content: 'old resp'}],
      isLoading: false,
      error: null,
      seedContextJson: 'old-context',
      contextRange: null,
    };
    state = reducer(state, startChatWithContext({insightText: 'new context', seedContextJson: null}));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('assistant');
    expect(state.seedContextJson).toBeNull();
  });

  it('startChatWithContext does not touch contextRange', () => {
    const range: ContextRange = {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-28T00:00:00.000Z',
    };
    const state: AIChatState = {...initial, contextRange: range};
    const result = reducer(
      state,
      startChatWithContext({insightText: 'insight', seedContextJson: null}),
    );
    expect(result.contextRange).toEqual(range);
  });
});
