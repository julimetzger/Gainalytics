import reducer, {
  appendMessage,
  clearChat,
  setError,
  setLoading,
  startChatWithContext,
  AIChatState,
} from '../../../app/redux/AIChat/aiChatSlice';

const initial: AIChatState = {messages: [], isLoading: false, error: null};

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

  it('clearChat resets to initial state', () => {
    let state: AIChatState = {
      messages: [{role: 'user', content: 'hi'}, {role: 'assistant', content: 'hello'}],
      isLoading: true,
      error: 'some error',
    };
    state = reducer(state, clearChat());
    expect(state).toEqual(initial);
  });

  it('startChatWithContext seeds conversation with one assistant message', () => {
    let state = reducer(initial, appendMessage({role: 'user', content: 'existing'}));
    state = reducer(state, startChatWithContext('Here is your analysis: great work!'));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual({role: 'assistant', content: 'Here is your analysis: great work!'});
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('startChatWithContext clears previous chat before seeding', () => {
    let state: AIChatState = {
      messages: [{role: 'user', content: 'old msg'}, {role: 'assistant', content: 'old resp'}],
      isLoading: false,
      error: null,
    };
    state = reducer(state, startChatWithContext('new context'));
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('assistant');
  });
});
