/**
 * GH-447 — the chat must never be stuck in "AI is thinking…".
 *
 * These tests drive the real screen against a real aiChat reducer, with only the network call
 * faked, so they cover what the user actually sees: the Stop button, the elapsed counter, and
 * what is left behind after a cancel, a timeout or an error.
 */
import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {combineReducers, createStore} from 'redux';
import AIChatTab from '../../../app/tabs/Analyse/AIChatTab';
import aiChatReducer, {AIChatState} from '../../../app/redux/AIChat/aiChatSlice';

// ── Mocks ────────────────────────────────────────────────────────────────────

// jest.setup.js globally stubs useSelector to `() => []` and useDispatch to a no-op, so a
// Provider-backed store is ignored. These tests drive the real reducer, so restore the real hooks.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const mockSendChatMessage = jest.fn();
jest.mock('../../../app/utils/ai/sendChatMessage', () => ({
  sendChatMessage: (...args: any[]) => mockSendChatMessage(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

jest.mock('@react-navigation/elements', () => ({useHeaderHeight: () => 0}));
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn(), setOptions: jest.fn()})}));

jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {
    hasAnthropicApiKey: () => true,
    getAnthropicApiKey: () => 'sk-test-key',
  },
  subscribeToApiKeyChanges: () => () => {},
}));

jest.mock('../../../app/utils/ai/chatHistoryStorage', () => ({
  archiveChatToFile: jest.fn(async () => null),
}));

jest.mock('../../../app/utils/ai/serializeTrainingsForChat', () => ({
  serializeTrainingsForChat: jest.fn(() => null),
}));

// The prompt/model settings are not under test here — pin them so the store stays minimal.
jest.mock('../../../app/redux/settings/use/useAIChatPrompt', () => ({
  useAIChatPrompt: () => 'You are a coach.',
}));
jest.mock('../../../app/redux/settings/use/useAnthropicModel', () => ({
  useAnthropicModel: () => 'claude-opus-5',
}));

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const {Text} = require('react-native');
  const MockMarkdown = ({children, testID}: any) =>
    React.createElement(Text, {testID: testID ?? 'markdown-component'}, children);
  MockMarkdown.displayName = 'Markdown';
  return {__esModule: true, default: MockMarkdown};
});

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const React = require('react');
  const {View} = require('react-native');
  class Range {
    startDate: Date;
    endDate: Date;
    constructor(startDate: Date, endDate: Date) {
      this.startDate = startDate;
      this.endDate = endDate;
    }
  }
  return {__esModule: true, default: () => React.createElement(View), Range};
});

// Interactive Paper stubs — the real components are not needed, but presses must land.
jest.mock('react-native-paper', () => {
  const React = require('react');
  const {View, Text, TouchableOpacity, TextInput: RNTextInput} = require('react-native');
  const theme = {
    colors: {
      primary: '#6200EE',
      onPrimary: '#FFFFFF',
      error: '#B3261E',
      surfaceVariant: '#E7E0EC',
      onSurfaceVariant: '#49454F',
      background: '#FFFBFE',
      onSurface: '#1C1B1F',
      errorContainer: '#F9DEDC',
      onErrorContainer: '#410E0B',
      outlineVariant: '#CAC4D0',
    },
  };
  const TextInput = Object.assign(
    ({testID, value, onChangeText, right}: any) =>
      React.createElement(
        View,
        null,
        React.createElement(RNTextInput, {testID, value, onChangeText}),
        right ?? null,
      ),
    {
      Icon: ({onPress, disabled, testID}: any) =>
        React.createElement(
          TouchableOpacity,
          {testID, onPress, accessibilityState: {disabled: !!disabled}},
          React.createElement(Text, null, testID),
        ),
    },
  );
  return {
    useTheme: () => theme,
    Text: ({children, testID, ...rest}: any) =>
      React.createElement(Text, {testID, ...rest}, children),
    Surface: ({children, ...rest}: any) => React.createElement(View, rest, children),
    ActivityIndicator: () => null,
    Chip: ({children, onPress, testID}: any) =>
      React.createElement(Text, {onPress, testID}, children),
    IconButton: ({onPress, disabled, testID}: any) =>
      React.createElement(
        TouchableOpacity,
        {testID, onPress, accessibilityState: {disabled: !!disabled}},
        React.createElement(Text, null, testID),
      ),
    TextInput,
    // The context-preview and training-picker dialogs (GH-391) are always mounted;
    // they only need to render without crashing here.
    Portal: ({children}: any) => React.createElement(React.Fragment, null, children),
    Dialog: Object.assign(
      ({visible, children}: any) => (visible ? React.createElement(View, null, children) : null),
      {
        Title: ({children}: any) => React.createElement(Text, null, children),
        Content: ({children}: any) => React.createElement(View, null, children),
        ScrollArea: ({children}: any) => React.createElement(View, null, children),
        Actions: ({children}: any) => React.createElement(View, null, children),
      },
    ),
    Button: ({children, onPress, testID}: any) =>
      React.createElement(TouchableOpacity, {testID, onPress}, React.createElement(Text, null, children)),
    List: {
      Item: ({title, onPress, testID}: any) =>
        React.createElement(TouchableOpacity, {testID, onPress}, React.createElement(Text, null, title)),
      Icon: () => null,
    },
  };
});

// ── Store ────────────────────────────────────────────────────────────────────

const emptyNormalized = {byId: {}, allIds: []};

// A user who has opened the chat before has a persisted 28-day context range.
const end = new Date();
const start = new Date(end.getTime() - 28 * 24 * 3600 * 1000);

function makeStore() {
  return createStore(
    combineReducers({
      aiChat: aiChatReducer,
      trainings: () => emptyNormalized,
      workouts: () => emptyNormalized,
      exercises: () => emptyNormalized,
      videoAnalyses: () => emptyNormalized,
      trainingsPlan: () => emptyNormalized,
    }) as any,
    {
      aiChat: {
        messages: [],
        isLoading: false,
        error: null,
        seedContextJson: null,
        contextRange: {startDate: start.toISOString(), endDate: end.toISOString()},
        history: [],
        pendingLegacyArchive: false,
      },
    } as any,
  );
}

/** The combined test reducer is untyped, so read the slice under test through one helper. */
function chatState(store: {getState: () => any}): AIChatState {
  return store.getState().aiChat;
}

function renderChat() {
  const store = makeStore();
  const utils = render(
    <Provider store={store}>
      <AIChatTab />
    </Provider>,
  );
  return {...utils, store};
}

/** A request that only settles once the caller aborts it — the GH-447 hang, made testable. */
function hangUntilAborted() {
  return (_msgs: any, _key: string, _sys: any, _model: string, opts: {signal: AbortSignal}) =>
    new Promise(resolve => {
      opts.signal.addEventListener('abort', () =>
        resolve({ok: false, kind: 'aborted', error: 'Request cancelled.'}),
      );
    });
}

async function send(getByTestId: any, text: string) {
  fireEvent.changeText(getByTestId('chat-input'), text);
  await act(async () => {
    fireEvent.press(getByTestId('chat-send-button'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AIChatTab — cancelling a running request (GH-447)', () => {
  it('offers a Stop button only while a request is in flight', async () => {
    mockSendChatMessage.mockImplementation(hangUntilAborted());
    const {getByTestId, queryByTestId} = renderChat();

    expect(queryByTestId('chat-stop-button')).toBeNull();

    await send(getByTestId, 'How is my squat?');
    expect(getByTestId('chat-stop-button')).toBeTruthy();
    expect(getByTestId('chat-loading')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('chat-stop-button'));
    });

    await waitFor(() => expect(queryByTestId('chat-stop-button')).toBeNull());
    expect(queryByTestId('chat-loading')).toBeNull();
  });

  it('actually aborts the signal handed to the network call', async () => {
    mockSendChatMessage.mockImplementation(hangUntilAborted());
    const {getByTestId} = renderChat();
    await send(getByTestId, 'How is my squat?');

    const {signal} = mockSendChatMessage.mock.calls[0][4];
    expect(signal.aborted).toBe(false);

    await act(async () => {
      fireEvent.press(getByTestId('chat-stop-button'));
    });
    expect(signal.aborted).toBe(true);
  });

  it('leaves the chat immediately usable again, with the message ready to resend', async () => {
    mockSendChatMessage.mockImplementation(hangUntilAborted());
    const {getByTestId, store} = renderChat();
    await send(getByTestId, 'How is my squat?');

    expect(chatState(store).messages).toEqual([
      {role: 'user', content: 'How is my squat?'},
    ]);

    await act(async () => {
      fireEvent.press(getByTestId('chat-stop-button'));
    });

    await waitFor(() => expect(chatState(store).isLoading).toBe(false));
    // The unanswered turn is rolled back and its text is back in the input box.
    expect(chatState(store).messages).toEqual([]);
    expect(getByTestId('chat-input').props.value).toBe('How is my squat?');
    expect(getByTestId('chat-send-button').props.accessibilityState.disabled).toBe(false);
  });

  it('can send the same message again after a cancel, and get an answer', async () => {
    mockSendChatMessage.mockImplementationOnce(hangUntilAborted());
    const {getByTestId, store} = renderChat();
    await send(getByTestId, 'How is my squat?');
    await act(async () => {
      fireEvent.press(getByTestId('chat-stop-button'));
    });
    await waitFor(() => expect(chatState(store).isLoading).toBe(false));

    mockSendChatMessage.mockResolvedValue({
      ok: true,
      text: 'Solid progress.',
      hadContext: false,
      truncated: false,
    });
    await act(async () => {
      fireEvent.press(getByTestId('chat-send-button'));
    });

    await waitFor(() =>
      expect(chatState(store).messages).toEqual([
        {role: 'user', content: 'How is my squat?'},
        {role: 'assistant', content: 'Solid progress.', hadContext: false},
      ]),
    );
    expect(chatState(store).error).toBeNull();
  });
});

describe('AIChatTab — a request that fails or times out (GH-447)', () => {
  it('surfaces a timeout message and stops the spinner', async () => {
    mockSendChatMessage.mockResolvedValue({
      ok: false,
      kind: 'timeout',
      error: 'The model did not answer within 120s. Check your connection, or try a faster model in Settings.',
    });
    const {getByTestId, queryByTestId, store} = renderChat();

    await send(getByTestId, 'Analyse my last block');

    await waitFor(() => expect(getByTestId('chat-error')).toBeTruthy());
    expect(queryByTestId('chat-loading')).toBeNull();
    expect(chatState(store).error).toContain('did not answer within 120s');
    // Nothing half-finished is left in the conversation.
    expect(chatState(store).messages).toEqual([]);
    expect(getByTestId('chat-input').props.value).toBe('Analyse my last block');
  });

  it('surfaces an API error the same way', async () => {
    mockSendChatMessage.mockResolvedValue({
      ok: false,
      kind: 'error',
      error: 'API error (500): upstream exploded',
    });
    const {getByTestId, queryByTestId, store} = renderChat();

    await send(getByTestId, 'Analyse my last block');

    await waitFor(() => expect(getByTestId('chat-error')).toBeTruthy());
    expect(queryByTestId('chat-loading')).toBeNull();
    expect(chatState(store).messages).toEqual([]);
    expect(chatState(store).error).toBe('API error (500): upstream exploded');
  });

  it('does not overwrite text the user already retyped while waiting', async () => {
    mockSendChatMessage.mockImplementation(hangUntilAborted());
    const {getByTestId, store} = renderChat();
    await send(getByTestId, 'First question');

    fireEvent.changeText(getByTestId('chat-input'), 'A different question');
    await act(async () => {
      fireEvent.press(getByTestId('chat-stop-button'));
    });

    await waitFor(() => expect(chatState(store).isLoading).toBe(false));
    expect(getByTestId('chat-input').props.value).toBe('A different question');
  });
});

describe('AIChatTab — showing that the app is still working (GH-447)', () => {
  it('shows the working indicator at all while a request runs', async () => {
    mockSendChatMessage.mockImplementation(hangUntilAborted());
    const {getByTestId, store} = renderChat();

    await send(getByTestId, 'How is my squat?');

    // Regression guard: clearing the previous error used to run after setLoading(true), and
    // setError also clears isLoading — which switched the spinner straight back off.
    expect(chatState(store).isLoading).toBe(true);
    expect(getByTestId('chat-loading')).toBeTruthy();
    expect(getByTestId('chat-send-button').props.accessibilityState.disabled).toBe(true);
  });

  it('clears a previous error when a new send starts', async () => {
    mockSendChatMessage.mockResolvedValueOnce({
      ok: false,
      kind: 'error',
      error: 'API error (500): boom',
    });
    const {getByTestId, queryByTestId, store} = renderChat();
    await send(getByTestId, 'first');
    await waitFor(() => expect(chatState(store).error).toBe('API error (500): boom'));

    mockSendChatMessage.mockImplementation(hangUntilAborted());
    await send(getByTestId, 'second');

    expect(chatState(store).error).toBeNull();
    expect(queryByTestId('chat-error')).toBeNull();
    expect(getByTestId('chat-loading')).toBeTruthy();
  });

  it('counts the seconds spent waiting so a long answer is distinguishable from a hang', async () => {
    jest.useFakeTimers();
    mockSendChatMessage.mockImplementation(hangUntilAborted());
    const {getByTestId} = renderChat();

    fireEvent.changeText(getByTestId('chat-input'), 'How is my squat?');
    await act(async () => {
      fireEvent.press(getByTestId('chat-send-button'));
    });

    expect(getByTestId('chat-loading-elapsed').props.children).toBe('AI is thinking… 0s');

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(getByTestId('chat-loading-elapsed').props.children).toBe('AI is thinking… 3s');

    await act(async () => {
      jest.advanceTimersByTime(7000);
    });
    expect(getByTestId('chat-loading-elapsed').props.children).toBe('AI is thinking… 10s');

    jest.useRealTimers();
  });
});
