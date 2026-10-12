import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import CoachInsightCard from '../../../app/components/Training/CoachInsightCard';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';
import {DEFAULT_ANTHROPIC_MODEL} from '../../../app/utils/llmApi';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const {Text} = require('react-native');
  const MockMarkdown = ({children, testID}: {children: string; testID?: string}) =>
    React.createElement(Text, {testID: testID ?? 'markdown-component'}, children);
  MockMarkdown.displayName = 'Markdown';
  return {__esModule: true, default: MockMarkdown};
});

const mockCallAnthropicClaude = jest.fn();
jest.mock('../../../app/utils/llmApi', () => ({
  callAnthropicClaude: (...args: any[]) => mockCallAnthropicClaude(...args),
  DEFAULT_ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
}));

// Default: return the default model; override per-test for the cold-start case.
const mockUseAnthropicModel = jest.fn(() => DEFAULT_ANTHROPIC_MODEL);
jest.mock('../../../app/redux/settings/use/useAnthropicModel', () => ({
  useAnthropicModel: () => mockUseAnthropicModel(),
}));

jest.mock('../../../app/redux/settings/use/useAITrainingPrompt', () => ({
  useAITrainingPrompt: () => 'mock training prompt',
}));

const mockInsightCacheGet = jest.fn();
const mockInsightCacheSet = jest.fn();
const mockInsightCacheDelete = jest.fn();
jest.mock('../../../app/utils/insightCache', () => ({
  insightCache: {
    get: (...args: any[]) => mockInsightCacheGet(...args),
    set: (...args: any[]) => mockInsightCacheSet(...args),
    delete: (...args: any[]) => mockInsightCacheDelete(...args),
    has: jest.fn(() => false),
  },
  formatGeneratedAt: (ts: number) => `Generated ${Math.floor((Date.now() - ts) / 3600000)}h ago`,
}));

const mockGetApiKey = jest.fn(() => 'sk-test-key');
let mockApiKeySubscribers: (() => void)[] = [];
jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {
    getAnthropicApiKey: () => mockGetApiKey(),
    setAnthropicApiKey: jest.fn(),
    deleteAnthropicApiKey: jest.fn(),
    hasAnthropicApiKey: jest.fn(() => true),
  },
  subscribeToApiKeyChanges: jest.fn((cb: () => void) => {
    mockApiKeySubscribers.push(cb);
    return () => {
      mockApiKeySubscribers = mockApiKeySubscribers.filter(s => s !== cb);
    };
  }),
}));

jest.mock('../../../app/utils/coachInsight', () => ({
  buildRawTrainingData: jest.fn(() => ({sessions: [{date: '2024-01-01', exercises: []}]})),
  buildCoachPrompt: jest.fn(() => ({system: 'sys', user: 'user'})),
}));

jest.mock('../../../app/utils/ai/serializeTrainingsForChat', () => ({
  serializeTrainingsForChat: jest.fn(() => null),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate}),
}));

// react-native-paper: minimal stubs
jest.mock('react-native-paper', () => {
  const React = require('react');
  const {View, Text, TouchableOpacity, ActivityIndicator} = require('react-native');
  return {
    Card: Object.assign(
      ({children, testID, style}: any) => <View testID={testID} style={style}>{children}</View>,
      {
        Title: ({title, right}: any) => (
          <View>
            {title}
            {right && right()}
          </View>
        ),
        Content: ({children}: any) => <View>{children}</View>,
      },
    ),
    IconButton: ({onPress, disabled, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress} accessibilityState={{disabled: !!disabled}}>
        <Text>{testID}</Text>
      </TouchableOpacity>
    ),
    Text: ({children, testID, style}: any) => <Text testID={testID} style={style}>{children}</Text>,
    ActivityIndicator: ({testID}: any) => <ActivityIndicator testID={testID} />,
    useTheme: () => ({colors: {primary: '#000', onSurfaceVariant: '#888', error: '#f00'}}),
  };
});

// GH-504: provider choice — Claude unless a test switches to ChatGPT.
const mockUseAiProvider = jest.fn(() => 'claude');
jest.mock('../../../app/redux/settings/use/useAiProvider', () => ({
  useAiProvider: () => mockUseAiProvider(),
}));
const mockChatGptSignedIn = jest.fn(() => false);
jest.mock('../../../app/utils/ai/useAiCredentials', () => ({
  useAiCredentials: () => mockChatGptSignedIn(),
}));
const mockCallChatGpt = jest.fn();
jest.mock('../../../app/utils/ai/chatgpt/chatgptChat', () => ({
  callChatGpt: (...args: any[]) => mockCallChatGpt(...args),
}));

const mockDispatch = jest.fn();
// useSelector returns empty objects by default; override per-test when needed.
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn((selector: any) => {
    // Return empty objects for workoutsById, exercisesById, videoAnalysesById
    return {};
  }),
  useDispatch: () => mockDispatch,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFinishedTraining(id: number, daysAgo = 0): Training {
  const end = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return {
    id,
    state: TrainingsState.FINISHED,
    end,
    start: end,
    doneWorkoutIds: {},
  } as unknown as Training;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockApiKeySubscribers = [];
  // By default: no cache hit, API returns success
  mockInsightCacheGet.mockReturnValue(undefined);
  mockCallAnthropicClaude.mockResolvedValue({ok: true, text: 'Focus on progressive overload.'});
  mockUseAnthropicModel.mockReturnValue(DEFAULT_ANTHROPIC_MODEL);
});

describe('CoachInsightCard — isActive=false', () => {
  it('renders nothing and makes no API call when isActive is false', async () => {
    const trainings = [makeFinishedTraining(1)];

    const {queryByTestId} = render(
      <CoachInsightCard trainings={trainings} isActive={false} />,
    );

    // Wait a tick to let any effects run
    await act(async () => {});

    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
    expect(queryByTestId('coach-insight-card')).toBeNull();
  });
});

describe('CoachInsightCard — refresh', () => {
  it('pressing refresh invalidates the cache and triggers a new API call', async () => {
    // First render: API call succeeds, insight cached
    const trainings = [makeFinishedTraining(1)];

    const {getByTestId} = render(
      <CoachInsightCard trainings={trainings} isActive={true} />,
    );

    // Wait for the initial API call to complete
    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));

    // State should now be 'done'
    await waitFor(() => getByTestId('coach-insight-text'));

    // Reset mocks for the refresh
    mockCallAnthropicClaude.mockClear();
    mockInsightCacheGet.mockReturnValue(undefined); // cache was deleted

    // Press refresh
    await act(async () => {
      fireEvent.press(getByTestId('coach-insight-refresh'));
    });

    // Cache should be invalidated
    expect(mockInsightCacheDelete).toHaveBeenCalled();

    // A second API call should be triggered
    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));
  });

  it('refresh button is disabled while loading', async () => {
    // Make the API call never resolve so we stay in loading state
    mockCallAnthropicClaude.mockReturnValue(new Promise(() => {}));

    const trainings = [makeFinishedTraining(1)];
    const {getByTestId} = render(
      <CoachInsightCard trainings={trainings} isActive={true} />,
    );

    await waitFor(() => getByTestId('coach-insight-loading'));

    const refreshBtn = getByTestId('coach-insight-refresh');
    expect(refreshBtn.props.accessibilityState?.disabled).toBe(true);
  });
});

describe('CoachInsightCard — timestamp', () => {
  it('shows a timestamp when the cache already has an entry', async () => {
    const cached = {text: 'Keep going!', generatedAt: Date.now() - 2 * 3_600_000};
    mockInsightCacheGet.mockReturnValue(cached);

    const trainings = [makeFinishedTraining(1)];
    const {getByTestId} = render(
      <CoachInsightCard trainings={trainings} isActive={true} />,
    );

    await waitFor(() => getByTestId('coach-insight-timestamp'));
    expect(getByTestId('coach-insight-text').props.children).toBe('Keep going!');
  });
});

describe('CoachInsightCard — empty trainings reset', () => {
  it('returns null (idle) when finishedTrainings is empty', async () => {
    const {queryByTestId} = render(
      <CoachInsightCard trainings={[]} isActive={true} />,
    );

    await act(async () => {});

    expect(queryByTestId('coach-insight-card')).toBeNull();
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
  });
});

describe('CoachInsightCard — cold-start with persisted custom model (GH-159-fix1, Codex comment 3107258434)', () => {
  it('uses the persisted custom model on the first API call before Settings is ever opened', async () => {
    // Simulate: user persisted 'claude-sonnet-4-6-20251001', cold-starts the app,
    // navigates directly to Training — Settings tab was never opened.
    // CoachInsightCard reads the model from Redux (via useAnthropicModel) and passes
    // it into callAnthropicClaude. There is no module-level cache to miss.
    const persistedModel = 'claude-sonnet-4-6-20251001';
    mockUseAnthropicModel.mockReturnValue(persistedModel);

    const trainings = [makeFinishedTraining(1)];

    render(<CoachInsightCard trainings={trainings} isActive={true} />);

    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));

    // The 4th argument is the model (apiKey, system, user, model)
    const [, , , modelArg] = mockCallAnthropicClaude.mock.calls[0];
    expect(modelArg).toBe(persistedModel);
  });
});

// ── GH-241: per-micro cache key tests ────────────────────────────────────────

describe('CoachInsightCard — GH-241 per-micro cache keys', () => {
  it('(a) two micro training sets produce two different cache lookups', async () => {
    // Micro 1 has training IDs 1,2 — micro 2 has IDs 3,4. Both have no cache entry.
    mockInsightCacheGet.mockReturnValue(undefined);
    mockCallAnthropicClaude
      .mockResolvedValueOnce({ok: true, text: 'Insight for micro 1.'})
      .mockResolvedValueOnce({ok: true, text: 'Insight for micro 2.'});

    const trainings1 = [makeFinishedTraining(1), makeFinishedTraining(2)];
    const trainings2 = [makeFinishedTraining(3), makeFinishedTraining(4)];

    const {rerender, getByTestId, unmount} = render(
      <CoachInsightCard trainings={trainings1} isActive={true} />,
    );
    await waitFor(() => getByTestId('coach-insight-text'));

    const firstCacheKey = mockInsightCacheGet.mock.calls[0][0] as string;

    unmount();
    jest.clearAllMocks();
    mockInsightCacheGet.mockReturnValue(undefined);
    mockCallAnthropicClaude.mockResolvedValue({ok: true, text: 'Insight for micro 2.'});

    render(<CoachInsightCard trainings={trainings2} isActive={true} />);
    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));

    const secondCacheKey = mockInsightCacheGet.mock.calls[0][0] as string;

    // The two micros must use different cache keys.
    expect(firstCacheKey).not.toBe(secondCacheKey);
    // Keys are derived from training IDs.
    expect(firstCacheKey).toBe('1,2');
    expect(secondCacheKey).toBe('3,4');
  });

  it('(b) finishing a workout in micro X invalidates that micro\'s cache', async () => {
    // Initial state: micro has one finished training → cache miss → API call.
    mockInsightCacheGet.mockReturnValue(undefined);
    mockCallAnthropicClaude.mockResolvedValue({ok: true, text: 'Old insight.'});

    const {rerender} = render(
      <CoachInsightCard trainings={[makeFinishedTraining(10)]} isActive={true} />,
    );
    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));

    const firstKey = mockInsightCacheGet.mock.calls[0][0] as string;
    expect(firstKey).toBe('10');

    // A second training is now finished in the same micro → new training set.
    mockCallAnthropicClaude.mockClear();
    mockInsightCacheGet.mockClear();
    mockInsightCacheGet.mockReturnValue(undefined); // new key is also a miss

    rerender(<CoachInsightCard trainings={[makeFinishedTraining(10), makeFinishedTraining(11)]} isActive={true} />);

    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));

    const secondKey = mockInsightCacheGet.mock.calls[0][0] as string;
    // Cache key changed because a new training ID entered the finished set.
    expect(secondKey).toBe('10,11');
    expect(secondKey).not.toBe(firstKey);
  });

  it('(c) old per-meso cache entry (large ID set) does not collide with per-micro key', async () => {
    // Simulate: old cache has an entry keyed by the full 28-day ID set "1,2,3,4,5".
    // After the migration, micro 1 only passes IDs [1,2] → different key → cache miss.
    const oldMesoKey = '1,2,3,4,5';
    const perMicroKey = '1,2';
    mockInsightCacheGet.mockImplementation((k: string) => {
      if (k === oldMesoKey) return {text: 'Old meso insight.', generatedAt: Date.now()};
      return undefined;
    });

    mockCallAnthropicClaude.mockResolvedValue({ok: true, text: 'Fresh micro insight.'});

    const microTrainings = [makeFinishedTraining(1), makeFinishedTraining(2)];
    render(<CoachInsightCard trainings={microTrainings} isActive={true} />);

    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));

    // The component queried with the per-micro key, not the old meso key.
    const queriedKey = mockInsightCacheGet.mock.calls[0][0] as string;
    expect(queriedKey).toBe(perMicroKey);
    expect(queriedKey).not.toBe(oldMesoKey);
  });
});

/**
 * GH-447 / GH-449 — what the card does with a reply that never comes, or comes cut in half.
 */
describe('CoachInsightCard — a call that never answers (GH-447)', () => {
  it('shows a readable message instead of spinning forever on a timeout', async () => {
    mockCallAnthropicClaude.mockResolvedValue({
      ok: false,
      error: {type: 'timeout', timeoutMs: 120_000},
    });

    const {queryByTestId, getByTestId} = render(
      <CoachInsightCard trainings={[makeFinishedTraining(1)]} />,
    );

    await waitFor(() => expect(getByTestId('coach-insight-error')).toBeTruthy());
    expect(getByTestId('coach-insight-error').props.children).toBe(
      'The insight took longer than 120s. Tap refresh to try again.',
    );
    // The spinner must be gone — an endless "Generating insight…" is the bug being fixed.
    expect(queryByTestId('coach-insight-loading')).toBeNull();
  });

  it('leaves the loading state after a timeout so refresh is usable again', async () => {
    mockCallAnthropicClaude.mockResolvedValue({
      ok: false,
      error: {type: 'timeout', timeoutMs: 120_000},
    });

    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} />);
    await waitFor(() => expect(getByTestId('coach-insight-error')).toBeTruthy());

    expect(getByTestId('coach-insight-refresh').props.accessibilityState.disabled).toBe(false);
  });

  it('passes an abort signal so a superseded or unmounted request can be cancelled', async () => {
    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} />);
    await waitFor(() => expect(getByTestId('coach-insight-text')).toBeTruthy());

    const options = mockCallAnthropicClaude.mock.calls[0][4];
    expect(options.signal).toBeDefined();
    expect(options.signal.aborted).toBe(false);
  });

  it('does not render a stale insight after the card unmounted', async () => {
    mockCallAnthropicClaude.mockResolvedValue({ok: true, text: 'Late answer.', truncated: false});
    const {unmount} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} />);
    unmount();

    const options = mockCallAnthropicClaude.mock.calls[0][4];
    expect(options.signal.aborted).toBe(true);
    // A response arriving after the abort must not reach the cache either.
    await act(async () => {});
    expect(mockInsightCacheSet).not.toHaveBeenCalled();
  });
});

describe('CoachInsightCard — a cut-off insight (GH-449)', () => {
  it('tells the user the advice was shortened', async () => {
    mockCallAnthropicClaude.mockResolvedValue({
      ok: true,
      text: 'Your quads are progressing while…',
      truncated: true,
    });

    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} />);

    await waitFor(() => expect(getByTestId('coach-insight-text')).toBeTruthy());
    expect(getByTestId('coach-insight-truncated').props.children).toBe(
      'Shortened — the answer hit the length limit.',
    );
    // The reader must still see a timestamp, and the text must not end mid-word.
    expect(getByTestId('coach-insight-timestamp')).toBeTruthy();
    expect(getByTestId('coach-insight-text').props.children).toBe(
      'Your quads are progressing while…',
    );
  });

  it('shows no shortened-notice on a complete insight', async () => {
    mockCallAnthropicClaude.mockResolvedValue({
      ok: true,
      text: 'Squat volume stalled. Add a set.',
      truncated: false,
    });

    const {getByTestId, queryByTestId} = render(
      <CoachInsightCard trainings={[makeFinishedTraining(1)]} />,
    );

    await waitFor(() => expect(getByTestId('coach-insight-text')).toBeTruthy());
    expect(queryByTestId('coach-insight-truncated')).toBeNull();
  });

  it('remembers the shortened flag through the cache, so a re-render keeps the notice', async () => {
    mockInsightCacheGet.mockReturnValue({
      text: 'Your quads are progressing while…',
      generatedAt: Date.now(),
      truncated: true,
    });

    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} />);

    await waitFor(() => expect(getByTestId('coach-insight-truncated')).toBeTruthy());
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
  });

  it('treats a cache entry written before this fix as not shortened', async () => {
    mockInsightCacheGet.mockReturnValue({text: 'Old cached insight.', generatedAt: Date.now()});

    const {getByTestId, queryByTestId} = render(
      <CoachInsightCard trainings={[makeFinishedTraining(1)]} />,
    );

    await waitFor(() => expect(getByTestId('coach-insight-text')).toBeTruthy());
    expect(queryByTestId('coach-insight-truncated')).toBeNull();
  });

  it('stores the shortened flag alongside the text when caching a fresh insight', async () => {
    mockCallAnthropicClaude.mockResolvedValue({
      ok: true,
      text: 'Your quads are progressing while…',
      truncated: true,
    });

    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} />);
    await waitFor(() => expect(getByTestId('coach-insight-text')).toBeTruthy());

    expect(mockInsightCacheSet.mock.calls[0][1]).toEqual({
      text: 'Your quads are progressing while…',
      generatedAt: expect.any(Number),
      truncated: true,
    });
  });
});

describe('CoachInsightCard — GH-504 ChatGPT provider', () => {
  beforeEach(() => mockUseAiProvider.mockReturnValue('chatgpt'));
  afterEach(() => {
    mockUseAiProvider.mockReturnValue('claude');
    mockChatGptSignedIn.mockReturnValue(false);
  });

  it('asks ChatGPT instead of Claude when signed in, and shows the answer', async () => {
    mockChatGptSignedIn.mockReturnValue(true);
    mockCallChatGpt.mockResolvedValue({ok: true, text: 'Deload next week.', truncated: false});

    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} isActive={true} />);

    await waitFor(() => expect(getByTestId('coach-insight-text')).toHaveTextContent('Deload next week.'));
    expect(mockCallChatGpt).toHaveBeenCalledWith('sys', 'user', undefined, {signal: expect.any(AbortSignal)});
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
  });

  it('stays hidden when not signed in to ChatGPT, even with a Claude key stored', async () => {
    const {queryByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} isActive={true} />);
    await act(async () => {});

    expect(queryByTestId('coach-insight-card')).toBeNull();
    expect(mockCallChatGpt).not.toHaveBeenCalled();
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
  });

  it('does not show the cached Claude insight after switching to ChatGPT', async () => {
    const cache = new Map<string, object>([['1', {text: 'Claude says squat more.', generatedAt: Date.now()}]]);
    mockInsightCacheGet.mockImplementation((k: string) => cache.get(k));
    mockInsightCacheSet.mockImplementation((k: string, v: object) => cache.set(k, v));
    mockUseAiProvider.mockReturnValue('claude');
    const trainings = [makeFinishedTraining(1)];

    const {getByTestId, rerender} = render(<CoachInsightCard trainings={trainings} isActive={true} />);
    await waitFor(() => expect(getByTestId('coach-insight-text')).toHaveTextContent('Claude says squat more.'));

    mockUseAiProvider.mockReturnValue('chatgpt');
    mockChatGptSignedIn.mockReturnValue(true);
    mockCallChatGpt.mockResolvedValue({ok: true, text: 'Deload next week.', truncated: false});
    rerender(<CoachInsightCard trainings={trainings} isActive={true} />);

    await waitFor(() => expect(getByTestId('coach-insight-text')).toHaveTextContent('Deload next week.'));
    expect(mockCallChatGpt).toHaveBeenCalledTimes(1);
    expect(cache.get('chatgpt:1')).toMatchObject({text: 'Deload next week.'});
    expect(cache.get('1')).toMatchObject({text: 'Claude says squat more.'});
  });

  it('hides a cached ChatGPT insight once the user signed out', async () => {
    const cache = new Map<string, object>([['chatgpt:1', {text: 'Deload next week.', generatedAt: Date.now()}]]);
    mockInsightCacheGet.mockImplementation((k: string) => cache.get(k));
    mockChatGptSignedIn.mockReturnValue(true);
    const trainings = [makeFinishedTraining(1)];

    const {getByTestId, queryByTestId, rerender} = render(<CoachInsightCard trainings={trainings} isActive={true} />);
    await waitFor(() => expect(getByTestId('coach-insight-text')).toHaveTextContent('Deload next week.'));

    mockChatGptSignedIn.mockReturnValue(false);
    rerender(<CoachInsightCard trainings={trainings} isActive={true} />);

    await waitFor(() => expect(queryByTestId('coach-insight-card')).toBeNull());
    expect(mockCallChatGpt).not.toHaveBeenCalled();
  });

  it('shows the worded ChatGPT failure, e.g. a reached usage limit', async () => {
    mockChatGptSignedIn.mockReturnValue(true);
    mockCallChatGpt.mockResolvedValue({ok: false, error: {type: 'provider_error', message: 'Your ChatGPT usage limit for Gainalytics is reached.'}});

    const {getByTestId} = render(<CoachInsightCard trainings={[makeFinishedTraining(1)]} isActive={true} />);

    await waitFor(() =>
      expect(getByTestId('coach-insight-error')).toHaveTextContent('Your ChatGPT usage limit for Gainalytics is reached.'),
    );
  });
});
