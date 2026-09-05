import reducer, {
  appendMessage,
  clearChat,
  setError,
  setLoading,
  setSeedContextJson,
  setContextRange,
  setIncludePlannedTrainings,
  setSelectedTrainingId,
  startChatWithContext,
  addHistoryEntry,
  removeHistoryEntry,
  setActiveMessages,
  setPendingLegacyArchive,
  AIChatState,
  ChatHistoryEntry,
  ChatSeedContext,
  ContextRange,
} from '../../../app/redux/AIChat/aiChatSlice';

const initial: AIChatState = {
  messages: [],
  isLoading: false,
  error: null,
  seedContextJson: null,
  contextRange: null,
  includePlannedTrainings: true,
  selectedTrainingId: null,
  history: [],
  pendingLegacyArchive: false,
};

function makeEntry(id: string, title = `Title ${id}`): ChatHistoryEntry {
  return {
    id,
    title,
    snippet: `Snippet ${id}`,
    createdAt: '2026-07-01T10:00:00.000Z',
    fileName: `${id}.json`,
    messageCount: 2,
  };
}

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
      ...initial,
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
      ...initial,
      messages: [{role: 'user', content: 'hi'}, {role: 'assistant', content: 'hello'}],
      isLoading: true,
      error: 'some error',
      seedContextJson: '{"sessions":[]}',
      contextRange: null,
    };
    expect(reducer(state, clearChat())).toEqual(initial);
  });

  it('clearChat preserves the history list', () => {
    const state: AIChatState = {
      ...initial,
      messages: [{role: 'user', content: 'hi'}],
      history: [makeEntry('a'), makeEntry('b')],
    };
    const result = reducer(state, clearChat());
    expect(result.messages).toHaveLength(0);
    expect(result.history).toHaveLength(2);
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
      ...initial,
      messages: [{role: 'user', content: 'old msg'}, {role: 'assistant', content: 'old resp'}],
      seedContextJson: 'old-context',
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

  it('startChatWithContext preserves the history list', () => {
    const state: AIChatState = {...initial, history: [makeEntry('a')]};
    const result = reducer(
      state,
      startChatWithContext({insightText: 'insight', seedContextJson: null}),
    );
    expect(result.history).toHaveLength(1);
  });
});

describe('aiChatSlice — chat history (GH-293)', () => {
  it('addHistoryEntry prepends: newest entry comes first', () => {
    let state = reducer(initial, addHistoryEntry(makeEntry('old')));
    state = reducer(state, addHistoryEntry(makeEntry('new')));
    expect(state.history.map(e => e.id)).toEqual(['new', 'old']);
  });

  it('removeHistoryEntry removes only the matching entry', () => {
    let state = reducer(initial, addHistoryEntry(makeEntry('a')));
    state = reducer(state, addHistoryEntry(makeEntry('b')));
    state = reducer(state, removeHistoryEntry('a'));
    expect(state.history.map(e => e.id)).toEqual(['b']);
  });

  it('removeHistoryEntry with unknown id leaves the list unchanged', () => {
    let state = reducer(initial, addHistoryEntry(makeEntry('a')));
    state = reducer(state, removeHistoryEntry('missing'));
    expect(state.history).toHaveLength(1);
  });

  it('setActiveMessages replaces the conversation and clears loading/error', () => {
    const state: AIChatState = {
      ...initial,
      messages: [{role: 'user', content: 'current'}],
      isLoading: true,
      error: 'boom',
    };
    const resumed = [
      {role: 'user' as const, content: 'archived question'},
      {role: 'assistant' as const, content: 'archived answer'},
    ];
    const result = reducer(state, setActiveMessages(resumed));
    expect(result.messages).toEqual(resumed);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
  });

  it('setActiveMessages does not touch history or context', () => {
    const state: AIChatState = {
      ...initial,
      history: [makeEntry('a')],
      seedContextJson: '{"sessions":[]}',
    };
    const result = reducer(state, setActiveMessages([{role: 'user', content: 'x'}]));
    expect(result.history).toHaveLength(1);
    expect(result.seedContextJson).toBe('{"sessions":[]}');
  });

  it('setPendingLegacyArchive toggles the flag', () => {
    let state = reducer(initial, setPendingLegacyArchive(true));
    expect(state.pendingLegacyArchive).toBe(true);
    state = reducer(state, setPendingLegacyArchive(false));
    expect(state.pendingLegacyArchive).toBe(false);
  });

  // ── GH-391: planning context + single-training subject ────────────────────

  it('planning is part of the context by default', () => {
    expect(initial.includePlannedTrainings).toBe(true);
    expect(initial.selectedTrainingId).toBeNull();
  });

  it('setIncludePlannedTrainings switches the planning half off and on again', () => {
    let state = reducer(initial, setIncludePlannedTrainings(false));
    expect(state.includePlannedTrainings).toBe(false);
    state = reducer(state, setIncludePlannedTrainings(true));
    expect(state.includePlannedTrainings).toBe(true);
  });

  it('setSelectedTrainingId selects and deselects a training', () => {
    let state = reducer(initial, setSelectedTrainingId(42));
    expect(state.selectedTrainingId).toBe(42);
    state = reducer(state, setSelectedTrainingId(null));
    expect(state.selectedTrainingId).toBeNull();
  });

  it('clearChat drops the subject but keeps the planning switch', () => {
    const state: AIChatState = {...initial, selectedTrainingId: 42, includePlannedTrainings: false};
    const result = reducer(state, clearChat());
    expect(result.selectedTrainingId).toBeNull();
    expect(result.includePlannedTrainings).toBe(false);
  });

  it('startChatWithContext drops a stale subject', () => {
    const state: AIChatState = {...initial, selectedTrainingId: 42};
    const result = reducer(state, startChatWithContext({insightText: 'insight', seedContextJson: null}));
    expect(result.selectedTrainingId).toBeNull();
  });
});
