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
