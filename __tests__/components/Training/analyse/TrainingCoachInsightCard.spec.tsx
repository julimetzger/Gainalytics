import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import {MD3DarkTheme, PaperProvider} from 'react-native-paper';
import rootReducer, {GlobalState} from '../../../../app/redux/rootReducer';
import {Muscles} from '../../../../app/models/Muscles';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import TrainingsOverview from '../../../../app/components/Training/analyse/TrainingsOverview';
import TrainingCoachInsightCard from '../../../../app/components/Training/analyse/TrainingCoachInsightCard';
import {DEFAULT_SESSION_PROMPT} from '../../../../app/constants/aiPrompts';

// GH-645 runs against the real store: what matters is which trainings of the store
// reach the prompt — a mocked selector would decide that for the test.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

jest.mock('react-native-markdown-display', () => {
  const {Text} = require('react-native');
  return {__esModule: true, default: ({children}: {children: string}) => <Text testID="markdown">{children}</Text>};
});

const mockCallAnthropicClaude = jest.fn();
jest.mock('../../../../app/utils/llmApi', () => ({
  ...jest.requireActual('../../../../app/utils/llmApi'),
  callAnthropicClaude: (...args: unknown[]) => mockCallAnthropicClaude(...args),
}));

let mockApiKey: string | undefined = 'sk-test-key';
jest.mock('../../../../app/utils/secureStorage', () => ({
  secureStorage: {
    getAnthropicApiKey: () => mockApiKey,
    hasAnthropicApiKey: () => mockApiKey !== undefined,
  },
  subscribeToApiKeyChanges: () => () => {},
}));

const mockCache = new Map<string, object>();
jest.mock('../../../../app/utils/insightCache', () => ({
  insightCache: {
    get: (k: string) => mockCache.get(k),
    set: (k: string, v: object) => mockCache.set(k, v),
    delete: (k: string) => mockCache.delete(k),
  },
  formatGeneratedAt: () => 'Generated just now',
}));

jest.mock('../../../../app/utils/ai/chatHistoryStorage', () => ({archiveChatToFile: jest.fn(async () => null)}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: mockNavigate}),
}));

jest.mock('../../../../app/components/Training/useVelocityLossInsights', () => ({useVelocityLossInsights: () => []}));

const set = (reps: number, weight: number, rir = 2) => ({reps, weight, rir});
const sets = (n: number, reps: number, weight: number, rir = 2) => Array.from({length: n}, () => set(reps, weight, rir));

const bench = {id: 1, name: 'Bench', muscles: [{muscle: Muscles.CHEST, percent: 100}, {muscle: Muscles.TRICEPS, percent: 50}]};
const squat = {id: 2, name: 'Squat', muscles: [{muscle: Muscles.QUADS, percent: 100}, {muscle: Muscles.GLUTES, percent: 50}]};
const row = {id: 3, name: 'Row', muscles: [{muscle: Muscles.BACK, percent: 100}]};

/**
 * Plan 1, one meso, position 1 = "Push squat", position 2 = "Pull".
 * Micro 1: 100 Push squat FINISHED (done bench 4 × 5 @ 100), 101 Pull FINISHED (done row)
 * Micro 2: 200 Push squat FINISHED (plan bench 3 × 5 @ 100 + squat 2 × 5 @ 150–160,
 *          done bench 2 × 5 @ 102.5 RIR 1), 201 Pull PLANNED (plan row only)
 */
const baseState = (): GlobalState =>
  ({
    exercises: {byId: {1: bench, 2: squat, 3: row}, allIds: [1, 2, 3]},
    workouts: {
      byId: {
        410: {id: 410, exerciseId: 1, sets: sets(4, 5, 100)},
        411: {id: 411, exerciseId: 3, sets: sets(3, 8, 60)},
        500: {id: 500, exerciseId: 1, sets: sets(3, 5, 100)},
        502: {id: 502, exerciseId: 2, sets: [{...set(5, 150), weightMax: 160}, {...set(5, 150), weightMax: 160}]},
        501: {id: 501, exerciseId: 3, sets: sets(3, 8, 60)},
        510: {id: 510, exerciseId: 1, sets: sets(2, 5, 102.5, 1)},
      },
      allIds: [410, 411, 500, 501, 502, 510],
      byExerciseId: {},
      plannedWorkouts: [],
    },
    trainings: {
      byId: {
        100: {id: 100, state: TrainingsState.FINISHED, exercises: [1], plannedWorkouts: {}, doneWorkoutIds: {1: 410}, start: new Date(Date.UTC(2026, 9, 6, 17)), end: new Date(Date.UTC(2026, 9, 6, 18))},
        101: {id: 101, state: TrainingsState.FINISHED, exercises: [3], plannedWorkouts: {}, doneWorkoutIds: {3: 411}, start: new Date(Date.UTC(2026, 9, 8, 17)), end: new Date(Date.UTC(2026, 9, 8, 18))},
        200: {
          id: 200,
          state: TrainingsState.FINISHED,
          exercises: [1, 2],
          plannedWorkouts: {1: 500, 2: 502},
          doneWorkoutIds: {1: 510},
          start: new Date(Date.UTC(2026, 9, 13, 17)),
          end: new Date(Date.UTC(2026, 9, 13, 18)),
        },
        201: {id: 201, state: TrainingsState.PLANNED, exercises: [3], plannedWorkouts: {3: 501}, doneWorkoutIds: {}},
      },
      allIds: [100, 101, 200, 201],
    },
    trainingsPlan: {
      byId: {1: {id: 1, name: 'Push pull', trainings: {'1,1': 100, '1,2': 101, '2,1': 200, '2,2': 201}, trainingNames: {1: 'Push squat', 2: 'Pull'}, mesos: [{id: 1, name: 'Meso 1', order: 0, startMicro: 1}]}},
      allIds: [1],
    },
    videoAnalyses: {byId: {}, allIds: []},
    settings: {mode: 'dark'},
    effects: {},
    aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null, selectedTrainingId: null, history: []},
  }) as unknown as GlobalState;

const renderWith = (ui: React.ReactElement, state: GlobalState = baseState()) => {
  const store = createStore((s: GlobalState | undefined, a: AnyAction) => rootReducer(s ?? state, a), state);
  const utils = render(
    <Provider store={store}>
      <PaperProvider theme={MD3DarkTheme}>{ui}</PaperProvider>
    </Provider>,
  );
  return {store, ...utils};
};

const plan = (state: GlobalState) => state.trainingsPlan.byId[1] as any;
const trainingOf = (state: GlobalState, id: number) => state.trainings.byId[id] as any;

/** The card on its own, as TrainingsOverview mounts it for Micro 2 · Push squat. */
const renderCard = (state: GlobalState = baseState(), {id = 200, isActive = true, previous = true} = {}) =>
  renderWith(
    <TrainingCoachInsightCard
      training={trainingOf(state, id)}
      previous={previous ? {training: trainingOf(state, 100), micro: 1} : undefined}
      trainingsPlan={plan(state)}
      micro={2}
      trainingInMicro={1}
      isActive={isActive}
    />,
    state,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCache.clear();
  mockApiKey = 'sk-test-key';
  mockCallAnthropicClaude.mockResolvedValue({ok: true, text: 'Bench is up 2.5 kg on last time.', truncated: false});
});

describe('GH-645 — Coach Insight of a single training', () => {
  it('sends only this training, its plan and the last training at its position', async () => {
    const state = baseState();
    const {getByTestId} = renderWith(<TrainingsOverview training={trainingOf(state, 200)} trainingsPlan={plan(state)} currentMicro={2} trainingInMicro={1} />, state);

    await waitFor(() => expect(getByTestId('training-coach-insight-card')).toBeTruthy());
    expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1);
    const [apiKey, system, user] = mockCallAnthropicClaude.mock.calls[0];
    expect({apiKey, system, user}).toEqual({
      apiKey: 'sk-test-key',
      system: DEFAULT_SESSION_PROMPT,
      user: [
        'Training: Micro 2 · Push squat (finished, 2026-10-13)',
        '',
        '=== PLAN OF THIS TRAINING ===',
        '  Bench [Chest, Triceps]',
        '    100kg × 5 reps, RIR 2',
        '    100kg × 5 reps, RIR 2',
        '    100kg × 5 reps, RIR 2',
        '  Squat [Quads, Glutes]',
        '    150–160kg × 5 reps, RIR 2',
        '    150–160kg × 5 reps, RIR 2',
        '=== DONE IN THIS TRAINING (2026-10-13) ===',
        '  Bench [Chest, Triceps]',
        '    102.5kg × 5 reps, RIR 1',
        '    102.5kg × 5 reps, RIR 1',
        '--- LAST TIME: Micro 1 · Push squat (2026-10-06), done ---',
        '  Bench [Chest, Triceps]',
        '    100kg × 5 reps, RIR 2',
        '    100kg × 5 reps, RIR 2',
        '    100kg × 5 reps, RIR 2',
        '    100kg × 5 reps, RIR 2',
        '',
        'Coach insight for this session:',
      ].join('\n'),
    });
    // The Pull of Micro 1 (Row) is in the store, but not part of this comparison.
    expect(user).not.toContain('Row');
    expect(getByTestId('markdown').props.children).toBe('Bench is up 2.5 kg on last time.');
  });

  it('uses the edited session prompt from the settings', async () => {
    const state = baseState();
    (state.settings as any).aiSessionPrompt = '  Only judge the bench press.  ';
    renderCard(state);

    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));
    expect(mockCallAnthropicClaude.mock.calls[0][1]).toBe('Only judge the bench press.');
  });

  it('says so when there is no earlier training at this position', async () => {
    renderCard(baseState(), {previous: false});

    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));
    expect(mockCallAnthropicClaude.mock.calls[0][2]).toContain('--- LAST TIME: no earlier training at this position ---');
  });

  it('shows no card and makes no request for a planned-only training', async () => {
    const state = baseState();
    const {queryByTestId} = renderWith(
      <TrainingCoachInsightCard training={trainingOf(state, 201)} trainingsPlan={plan(state)} micro={2} trainingInMicro={2} isActive />,
      state,
    );
    await act(async () => {});

    expect(queryByTestId('training-coach-insight-card')).toBeNull();
    expect(queryByTestId('training-coach-insight-notice')).toBeNull();
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
  });

  it('asks for a started training once sets are logged', async () => {
    const state = baseState();
    (state.trainings.byId[200] as any).state = TrainingsState.STARTED;
    (state.trainings.byId[200] as any).end = undefined;
    renderCard(state);

    await waitFor(() => expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1));
    expect(mockCallAnthropicClaude.mock.calls[0][2]).toContain('Training: Micro 2 · Push squat (in progress, 2026-10-13)');
  });

  it('makes no request while the pane is off-screen, and one once it becomes active', async () => {
    const state = baseState();
    const {rerender, getByTestId, queryByTestId} = renderCard(state, {isActive: false});
    await act(async () => {});
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();
    expect(queryByTestId('training-coach-insight-card')).toBeNull();

    rerender(
      <Provider store={createStore(() => state)}>
        <PaperProvider theme={MD3DarkTheme}>
          <TrainingCoachInsightCard training={trainingOf(state, 200)} previous={{training: trainingOf(state, 100), micro: 1}} trainingsPlan={plan(state)} micro={2} trainingInMicro={1} isActive />
        </PaperProvider>
      </Provider>,
    );
    await waitFor(() => expect(getByTestId('training-coach-insight-card')).toBeTruthy());
    expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1);
  });

  it('shows the cached insight without a request, and "Ask again" asks anew', async () => {
    mockCache.set('training:200:100:2:5', {text: 'Cached session insight.', generatedAt: Date.now()});
    const {getByTestId} = renderCard();

    await waitFor(() => expect(getByTestId('markdown').props.children).toBe('Cached session insight.'));
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByTestId('training-coach-insight-refresh'));
    });
    await waitFor(() => expect(getByTestId('markdown').props.children).toBe('Bench is up 2.5 kg on last time.'));
    expect(mockCallAnthropicClaude).toHaveBeenCalledTimes(1);
    expect(mockCache.get('training:200:100:2:5')).toEqual({text: 'Bench is up 2.5 kg on last time.', generatedAt: expect.any(Number), truncated: false});
  });

  it('continues in the AI chat about this training', async () => {
    const {getByTestId, store} = renderCard();
    await waitFor(() => expect(getByTestId('training-coach-insight-ask-ai')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('training-coach-insight-ask-ai'));
    });

    const chat = store.getState().aiChat;
    expect({messages: chat.messages, selectedTrainingId: chat.selectedTrainingId}).toEqual({
      messages: [{role: 'assistant', content: 'Bench is up 2.5 kg on last time.'}],
      selectedTrainingId: 200,
    });
    // The seeded context holds this training and its comparison training only.
    expect(JSON.parse(chat.seedContextJson!).sessions.map((s: {date: string}) => s.date)).toEqual(['2026-10-06', '2026-10-13']);
    expect(mockNavigate).toHaveBeenCalledWith('Analyse', {screen: 'AIChat'});
  });
});

describe('GH-645 (V18) — single training without an API key', () => {
  it('shows the notice with a link to the AI settings instead of nothing', async () => {
    mockApiKey = undefined;
    const {getByTestId, queryByTestId} = renderCard();
    await act(async () => {});

    expect(queryByTestId('training-coach-insight-card')).toBeNull();
    expect(getByTestId('training-coach-insight-notice-text').props.children).toBe('Coach Insight – available with an API key in Settings');
    expect(mockCallAnthropicClaude).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('training-coach-insight-notice-link'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings', {screen: 'Settings', params: {openAiConfig: true}});
  });

  it('shows no notice for a planned-only training', async () => {
    mockApiKey = undefined;
    const state = baseState();
    const {queryByTestId} = renderWith(
      <TrainingCoachInsightCard training={trainingOf(state, 201)} trainingsPlan={plan(state)} micro={2} trainingInMicro={2} isActive />,
      state,
    );
    await act(async () => {});

    expect(queryByTestId('training-coach-insight-notice')).toBeNull();
  });
});
