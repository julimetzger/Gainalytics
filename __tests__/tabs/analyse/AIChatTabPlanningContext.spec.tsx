/**
 * GH-391 — the chat's planning context, driven through the real screen.
 *
 * Every assertion reads the context preview, which renders the very strings the
 * system prompt is built from (see utils/ai/buildChatContext). "Not in the
 * preview" therefore means "not in the prompt".
 */

import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import {Provider as ReduxProvider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {setActiveMessages} from '../../../app/redux/AIChat/aiChatSlice';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../app/models/entities/WorkoutSet';
import {Exercise} from '../../../app/models/entities/Exercise';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';

// jest.setup.js stubs useSelector globally; this suite drives the screen through
// a real store, so the real hooks are needed here.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {
    hasAnthropicApiKey: () => true,
    getAnthropicApiKey: () => 'test-key',
  },
  subscribeToApiKeyChanges: () => () => {},
}));

jest.mock('@react-navigation/elements', () => ({useHeaderHeight: () => 0}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: any) => React.useEffect(cb, []),
    useIsFocused: () => true,
    // GH-508: the screen hands its history/filter/clear buttons to the navigation
    // header. The harness below renders whatever headerRight the screen sets.
    useNavigation: () => ({navigate: jest.fn(), setOptions: (o: any) => mockHeader.set(o.headerRight)}),
  };
});

const mockHeader: {set: (h: any) => void} = {set: () => {}};

function HeaderHarness({children}: {children: React.ReactNode}) {
  const [headerRight, setHeaderRight] = React.useState<any>(undefined);
  mockHeader.set = (h: any) => setHeaderRight(() => h);
  return (
    <>
      {headerRight ? headerRight() : null}
      {children}
    </>
  );
}

jest.mock('react-native-markdown-display', () => {
  const {Text} = require('react-native');
  return {__esModule: true, default: ({children}: any) => <Text>{children}</Text>};
});

jest.mock('../../../app/redux/AIChat/use/useArchiveActiveChat', () => ({
  useArchiveActiveChat: () => async () => {},
}));

// react-native-paper-dates' calendar does not mount under the RN test renderer.
// The picker itself is not what this suite is about — only that it is still there.
jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const {Text} = require('react-native');
  const actual = jest.requireActual('../../../app/components/picker/date/DateRangePicker');
  return {
    __esModule: true,
    default: () => <Text testID="date-range-picker-stub">range picker</Text>,
    Range: actual.Range,
  };
});

import AIChatTab from '../../../app/tabs/Analyse/AIChatTab';

const set = (reps: number, weight: number, rir: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  reps,
  weight,
  rir,
  ...extra,
});

const exercises: Record<number, Exercise> = {
  10: {id: 10, name: 'Squat'},
  11: {id: 11, name: 'Bench Press'},
};

/**
 * Micro 1 is trained (Squat 5x100), micro 2 is planned with a rep range 8-12
 * and RIR 1-3 — the two things the acceptance criteria ask to see.
 */
function buildState(over: {trainings?: Record<number, Training>; plans?: TrainingsPlan[]} = {}): GlobalState {
  const workoutsById: Record<number, Workout> = {
    100: {id: 100, exerciseId: 10, sets: [set(5, 100, 2)]},
    101: {id: 101, exerciseId: 10, sets: [set(5, 102.5, 2)]},
    200: {id: 200, exerciseId: 10, sets: [set(8, 110, 1, {repsMax: 12, rirMax: 3})]},
    201: {id: 201, exerciseId: 11, sets: [set(10, 60, 2)]},
  };

  const trainingsById: Record<number, Training> = over.trainings ?? {
    1: {
      id: 1,
      state: TrainingsState.FINISHED,
      start: new Date('2026-09-01T17:00:00.000Z'),
      end: new Date('2026-09-01T18:00:00.000Z'),
      exercises: [10],
      doneWorkoutIds: {10: 100},
      plannedWorkouts: {10: 101},
    },
    2: {
      id: 2,
      state: TrainingsState.PLANNED,
      exercises: [10, 11],
      doneWorkoutIds: {},
      plannedWorkouts: {10: 200, 11: 201},
    },
  };

  const plans: TrainingsPlan[] = over.plans ?? [
    {
      id: 1,
      name: 'Push pull',
      trainings: {'1,1': 1, '2,1': 2},
      trainingNames: {1: 'Push', 2: 'Pull'},
      mesos: [{id: 1, name: 'Block A', order: 1, startMicro: 1}],
    },
  ];

  return {
    trainings: {byId: trainingsById, allIds: Object.keys(trainingsById).map(Number)},
    workouts: {byId: workoutsById, allIds: Object.keys(workoutsById).map(Number), byExerciseId: {}, plannedWorkouts: []},
    exercises: {byId: exercises, allIds: [10, 11]},
    trainingsPlan: {byId: Object.fromEntries(plans.map(p => [p.id!, p])), allIds: plans.map(p => p.id!)},
    videoAnalyses: {byId: {}, allIds: []},
    settings: {aiChatPrompt: 'You are a powerlifting coach.'},
    effects: {},
    aiChat: {
      messages: [],
      isLoading: false,
      error: null,
      seedContextJson: null,
      contextRange: null,
      includePlannedTrainings: true,
      selectedTrainingId: null,
      history: [],
      pendingLegacyArchive: false,
    },
  } as unknown as GlobalState;
}

function renderTab(preloadedState: GlobalState) {
  const store = configureStore({
    reducer: rootReducer as any,
    preloadedState: preloadedState as any,
    middleware: getDefault => getDefault({serializableCheck: false, immutableCheck: false}),
  });
  render(
    <ReduxProvider store={store}>
      <PaperProvider>
        <HeaderHarness>
          <AIChatTab />
        </HeaderHarness>
      </PaperProvider>
    </ReduxProvider>,
  );
  return store;
}

/** The context exactly as the prompt builder assembles it. */
const openPreview = () => {
  fireEvent.press(screen.getByTestId('chat-context-inspect'));
};

describe('GH-391 planned trainings reach the chat context', () => {
  it('shows the planned session with meso, micro, position, name, exercises and sets', () => {
    renderTab(buildState());
    openPreview();

    const planned = JSON.parse(screen.getByTestId('chat-context-preview-planned').props.children);
    expect(planned.plan_name).toBe('Push pull');
    expect(planned.sessions).toHaveLength(1);
    expect(planned.sessions[0]).toMatchObject({
      meso_name: 'Block A',
      micro: 2,
      micro_in_meso: 2,
      position: 1,
      name: 'Push',
      state: 'planned',
    });
    expect(planned.sessions[0].exercises.map((e: any) => e.name)).toEqual(['Squat', 'Bench Press']);
    expect(planned.sessions[0].exercises[1].sets).toEqual([{reps: 10, weight_kg: 60, rir: 2}]);
  });

  it('keeps a planned range a range', () => {
    renderTab(buildState());
    openPreview();

    const raw = screen.getByTestId('chat-context-preview-planned').props.children as string;
    expect(raw).toContain('"reps":"8-12"');
    expect(raw).toContain('"rir":"1-3"');
    const planned = JSON.parse(raw);
    expect(planned.sessions[0].exercises[0].sets[0]).toEqual({reps: '8-12', weight_kg: 110, rir: '1-3'});
  });

  it('removes the planning from the context when the user switches it off', () => {
    renderTab(buildState());

    openPreview();
    expect(screen.getByTestId('chat-context-preview-planned')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-context-preview-close'));

    fireEvent.press(screen.getByTestId('chat-planned-toggle'));

    openPreview();
    expect(screen.queryByTestId('chat-context-preview-planned')).toBeNull();
  });

  it('labels the planning chip so the user can see the plan is attached', () => {
    renderTab(buildState());
    expect(screen.getByTestId('chat-planned-toggle')).toHaveTextContent('Plan: 1 session');
    fireEvent.press(screen.getByTestId('chat-planned-toggle'));
    expect(screen.getByTestId('chat-planned-toggle')).toHaveTextContent('Plan: off');
  });

  it('leaves the context clean when nothing is planned', () => {
    const state = buildState({
      trainings: {
        1: {
          id: 1,
          state: TrainingsState.FINISHED,
          start: new Date('2026-09-01T17:00:00.000Z'),
          end: new Date('2026-09-01T18:00:00.000Z'),
          exercises: [10],
          doneWorkoutIds: {10: 100},
          plannedWorkouts: {},
        },
      },
      plans: [{id: 1, name: 'Push pull', trainings: {'1,1': 1}, trainingNames: {1: 'Push'}}],
    });
    renderTab(state);

    expect(screen.getByTestId('chat-planned-toggle')).toHaveTextContent('Plan: 0 sessions');
    openPreview();
    expect(screen.queryByTestId('chat-context-preview-planned')).toBeNull();
    // the pre-existing finished-training half is untouched
    expect(screen.getByTestId('chat-context-preview-finished')).toBeTruthy();
  });
});

describe('GH-391 a single training as the subject of the conversation', () => {
  it('selects a planned training and shows it in the chat', () => {
    renderTab(buildState());
    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Training: none');

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    fireEvent.press(screen.getByTestId('chat-training-option-2'));

    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Micro 2 · Push');

    openPreview();
    const selected = JSON.parse(screen.getByTestId('chat-context-preview-selected').props.children);
    expect(selected).toMatchObject({training_id: 2, name: 'Push', state: 'planned', micro: 2});
    expect(selected.planned[0].sets[0]).toEqual({reps: '8-12', weight_kg: 110, rir: '1-3'});
    expect(selected.performed).toBeUndefined();
  });

  it('gives a finished training both the plan and what was actually done', () => {
    renderTab(buildState());

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    fireEvent.press(screen.getByTestId('chat-training-option-1'));

    openPreview();
    const selected = JSON.parse(screen.getByTestId('chat-context-preview-selected').props.children);
    expect(selected.state).toBe('finished');
    expect(selected.planned).toEqual([{name: 'Squat', sets: [{reps: 5, weight_kg: 102.5, rir: 2}]}]);
    expect(selected.performed).toEqual([{name: 'Squat', sets: [{reps: 5, weight_kg: 100, rir: 2}]}]);
  });

  it('deselects the training again', () => {
    renderTab(buildState());

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    fireEvent.press(screen.getByTestId('chat-training-option-2'));
    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Micro 2 · Push');

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    fireEvent.press(screen.getByTestId('chat-training-option-none'));

    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Training: none');
    openPreview();
    expect(screen.queryByTestId('chat-context-preview-selected')).toBeNull();
  });
});

/**
 * GH-391 review, misbehaviour 1 — the user has finished an old plan and created a
 * new one without training a single session from it. Before the fix the old plan
 * won on recency and the chat saw no planning at all.
 */
describe('GH-391 a newly created plan reaches the chat before it is trained', () => {
  const oldAndNewPlan = () =>
    buildState({
      trainings: {
        1: {
          id: 1,
          state: TrainingsState.FINISHED,
          start: new Date('2026-09-01T17:00:00.000Z'),
          end: new Date('2026-09-01T18:00:00.000Z'),
          exercises: [10],
          doneWorkoutIds: {10: 100},
          plannedWorkouts: {10: 101},
        },
        2: {
          id: 2,
          state: TrainingsState.PLANNED,
          exercises: [10, 11],
          doneWorkoutIds: {},
          plannedWorkouts: {10: 200, 11: 201},
        },
      },
      plans: [
        // fully trained — nothing of it is still ahead of the user
        {id: 1, name: 'Old block', trainings: {'1,1': 1}, trainingNames: {1: 'Push'}},
        // brand new, never touched
        {id: 2, name: 'New block', trainings: {'1,1': 2}, trainingNames: {1: 'Squat day'}},
      ],
    });

  it('puts the untouched plan’s sessions into the context', () => {
    renderTab(oldAndNewPlan());

    expect(screen.getByTestId('chat-planned-toggle')).toHaveTextContent('Plan: 1 session');
    openPreview();
    const planned = JSON.parse(screen.getByTestId('chat-context-preview-planned').props.children);
    expect(planned.plan_name).toBe('New block');
    expect(planned.sessions[0]).toMatchObject({micro: 1, name: 'Squat day', state: 'planned'});
    expect(planned.sessions[0].exercises[0].sets[0]).toEqual({reps: '8-12', weight_kg: 110, rir: '1-3'});
  });

  it('names the plan the chat knows, so the user can see which one it is', () => {
    renderTab(oldAndNewPlan());
    fireEvent.press(screen.getByTestId('chat-filter-toggle'));
    expect(screen.getByTestId('chat-planned-info')).toHaveTextContent('New block');
  });

  it('offers the untouched plan’s training as a subject', () => {
    renderTab(oldAndNewPlan());

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    fireEvent.press(screen.getByTestId('chat-training-option-2'));

    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Micro 1 · Squat day');
    openPreview();
    const selected = JSON.parse(screen.getByTestId('chat-context-preview-selected').props.children);
    expect(selected).toMatchObject({training_id: 2, plan_name: 'New block', state: 'planned'});
  });

  it('still keeps the finished sessions of the old plan selectable', () => {
    renderTab(oldAndNewPlan());
    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    expect(screen.getByTestId('chat-training-option-1')).toBeTruthy();
  });
});

/**
 * GH-391 review, misbehaviour 2 — the subject belongs to the conversation it was
 * picked in. Resuming an archived conversation must never inherit it.
 */
describe('GH-391 the subject does not travel between conversations', () => {
  it('drops the subject when another conversation is resumed', () => {
    const store = renderTab(buildState());

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    fireEvent.press(screen.getByTestId('chat-training-option-2'));
    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Micro 2 · Push');
    openPreview();
    expect(screen.getByTestId('chat-context-preview-selected')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-context-preview-close'));

    // what ChatHistoryTab does when the user continues an archived conversation
    act(() => {
      store.dispatch(setActiveMessages([{role: 'user', content: 'an older conversation'}]));
    });

    expect(store.getState().aiChat.selectedTrainingId).toBeNull();
    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Training: none');
    openPreview();
    expect(screen.queryByTestId('chat-context-preview-selected')).toBeNull();
  });

  it('shows a subject the picker no longer offers instead of reading "none"', () => {
    const base = buildState();
    // Training 3 is planned but sits in no plan, so the picker does not list it.
    // It is still in the context — and a subject that is sent must be readable.
    const state = buildState({
      trainings: {
        ...(base.trainings.byId as Record<number, Training>),
        3: {
          id: 3,
          state: TrainingsState.PLANNED,
          exercises: [11],
          doneWorkoutIds: {},
          plannedWorkouts: {11: 201},
        },
      },
    });
    renderTab({...state, aiChat: {...state.aiChat, selectedTrainingId: 3}} as GlobalState);

    fireEvent.press(screen.getByTestId('chat-subject-chip'));
    expect(screen.getByTestId('chat-training-option-2')).toBeTruthy();
    expect(screen.queryByTestId('chat-training-option-3')).toBeNull();
    fireEvent.press(screen.getByTestId('chat-training-picker-close'));

    expect(screen.getByTestId('chat-subject-chip')).toHaveTextContent('Training 3 (planned)');
    openPreview();
    const selected = JSON.parse(screen.getByTestId('chat-context-preview-selected').props.children);
    expect(selected.training_id).toBe(3);
  });
});

describe('GH-391 does not disturb what already worked', () => {
  it('keeps the finished-training range picker and its badge', () => {
    renderTab(buildState());
    expect(screen.getByTestId('chat-context-badge')).toHaveTextContent('Context: 28d');

    fireEvent.press(screen.getByTestId('chat-filter-toggle'));
    expect(screen.getByTestId('chat-preset-7d')).toBeTruthy();
    expect(screen.getByTestId('chat-date-range-picker')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chat-preset-7d'));
    expect(screen.getByTestId('chat-context-info')).toHaveTextContent('AI has access to');
  });
});

describe('GH-508 more room for the chat', () => {
  it('does not repeat the "AI Chat" title inside the screen', () => {
    renderTab(buildState());
    // The navigation header owns the title; the screen itself must not render it.
    expect(screen.queryByText('AI Chat')).toBeNull();
  });

  it('opens and closes the range filter from the context-period chip as well', () => {
    renderTab(buildState());
    expect(screen.queryByTestId('chat-preset-7d')).toBeNull();

    fireEvent.press(screen.getByTestId('chat-context-badge'));
    expect(screen.getByTestId('chat-preset-7d')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-preset-7d'));
    expect(screen.getByTestId('chat-context-badge')).toHaveTextContent('Context: 7d');

    fireEvent.press(screen.getByTestId('chat-context-badge'));
    expect(screen.queryByTestId('chat-preset-7d')).toBeNull();
  });

  it('keeps clear disabled in the header until there is something to clear', () => {
    renderTab(buildState());
    expect(screen.getByTestId('chat-clear-button')).toBeDisabled();
  });
});
