/**
 * Tests for GH-162-fix1: reference-based memoization in AIChatTab.
 * Tests for GH-186: Markdown rendering in assistant bubbles.
 */

import React from 'react';
import {render} from '@testing-library/react-native';
import {useSelector} from 'react-redux';
import {selectAllFinishedTrainings} from '../../../app/redux/AIChat/selectors';
import trainingsReducer from '../../../app/redux/Training/trainingsReducer';
import {serializeTrainingsForChat} from '../../../app/utils/ai/serializeTrainingsForChat';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {Exercise} from '../../../app/models/entities/Exercise';
import {GlobalState} from '../../../app/redux/rootReducer';
import {computeMesoRange} from '../../../app/tabs/Analyse/AIChatTab';

function makePlannedTraining(id: number): Training {
  return {
    id,
    state: TrainingsState.PLANNED,
    doneWorkoutIds: {10: 100},
    plannedWorkouts: {},
    exercises: [10],
  } as Training;
}

function makeWorkout(id: number, weightKg: number): Workout {
  return {
    id,
    sets: [{index: 0, reps: 5, weight: weightKg, rir: 2, date: new Date()}],
    exerciseId: 10,
    trainingsId: 1,
  } as unknown as Workout;
}

function makeExercise(id: number, name: string): Exercise {
  return {id, name, muscles: []};
}

function makeGlobalState(trainingsState: {byId: Record<number, Training>; allIds: number[]}): GlobalState {
  return {trainings: trainingsState} as unknown as GlobalState;
}

describe('AIChatTab memoization fix (GH-162-fix1)', () => {
  it('FINISH_TRAINING updates selectAllFinishedTrainings even when allIds.length is unchanged', () => {
    // One PLANNED training — allIds.length = 1 before and after FINISH_TRAINING.
    // Old memo `[trainingsAllIds.length]` would return stale []; new createSelector returns [training].
    const initialTrainings = {
      byId: {1: makePlannedTraining(1)} as Record<number, Training>,
      allIds: [1],
    };

    const before = selectAllFinishedTrainings(makeGlobalState(initialTrainings));
    expect(before).toHaveLength(0);

    // FINISH_TRAINING mutates byId content but allIds stays [1] (length unchanged).
    const newTrainings = trainingsReducer(initialTrainings as any, {
      type: 'FINISH_TRAINING',
      trainingsId: 1,
      date: new Date().toISOString(),
    } as any);

    expect(newTrainings.allIds.length).toBe(initialTrainings.allIds.length); // length still 1

    const after = selectAllFinishedTrainings(makeGlobalState(newTrainings as any));
    expect(after).toHaveLength(1);
    expect(after[0].state).toBe(TrainingsState.FINISHED);
  });

  it('set-value update changes seedContextJson content without changing workout count', () => {
    // This proves the old `workoutCount` dep was insufficient: count stays 1,
    // but weight changes from 100 → 105 → serializeTrainingsForChat returns different JSON.
    // With the fixed effect deps ([..., workoutsById, ...]) the effect fires on reference change.
    const finishedTraining: Training = {
      id: 1,
      state: TrainingsState.FINISHED,
      end: new Date('2026-04-01'),
      doneWorkoutIds: {10: 100},
      plannedWorkouts: {},
      exercises: [10],
    } as Training;

    const exercises: Record<number, Exercise> = {10: makeExercise(10, 'Squat')};

    const workoutsBefore: Record<number, Workout> = {100: makeWorkout(100, 100)};
    const workoutsAfter: Record<number, Workout> = {100: makeWorkout(100, 105)};

    // Counts are identical — old dep would miss this change.
    expect(Object.keys(workoutsBefore).length).toBe(Object.keys(workoutsAfter).length);

    // But object references differ (new Redux state after reducer), so new dep fires.
    expect(workoutsBefore).not.toBe(workoutsAfter);

    const jsonBefore = serializeTrainingsForChat([finishedTraining], workoutsBefore, exercises, {});
    const jsonAfter = serializeTrainingsForChat([finishedTraining], workoutsAfter, exercises, {});

    expect(jsonBefore).not.toBeNull();
    expect(jsonAfter).not.toBeNull();
    expect(jsonBefore).not.toBe(jsonAfter);

    const parsedBefore = JSON.parse(jsonBefore!);
    const parsedAfter = JSON.parse(jsonAfter!);
    expect(parsedBefore.sessions[0].exercises[0].sets[0].weight_kg).toBe(100);
    expect(parsedAfter.sessions[0].exercises[0].sets[0].weight_kg).toBe(105);
  });
});

describe('computeMesoRange meso boundary fix (GH-162-fix2)', () => {
  // Plan layout:
  //   Meso 1: micros 1–4   (trainings T1, T2)
  //   Meso 2: micros 5–8   (trainings T3, T4)  ← current meso (most recent finished training)
  //   Meso 3: micros 9–12  (trainings T5, T6)
  //
  // computeMesoRange must detect meso 2 as the current meso and return only T3/T4.
  // T1/T2 (meso 1) and T5/T6 (meso 3) must be excluded.

  const mesos = [
    {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
    {id: 2, name: 'Meso 2', order: 2, startMicro: 5},
    {id: 3, name: 'Meso 3', order: 3, startMicro: 9},
  ];

  // trainings map: key = "micro,trainingInMicro"
  const plan = {
    id: 1,
    name: 'Test Plan',
    trainings: {
      '1,1': 101, // micro 1 (meso 1)
      '3,1': 102, // micro 3 (meso 1)
      '5,1': 103, // micro 5 (meso 2) ← most recently finished
      '7,1': 104, // micro 7 (meso 2)
      '9,1': 105, // micro 9 (meso 3)
      '11,1': 106, // micro 11 (meso 3)
    },
    trainingNames: {},
    mesos,
  };

  function makeFinished(id: number, startIso: string, endIso: string): Training {
    return {
      id,
      state: TrainingsState.FINISHED,
      start: new Date(startIso),
      end: new Date(endIso),
      doneWorkoutIds: {},
      plannedWorkouts: {},
      exercises: [],
    } as unknown as Training;
  }

  // T103/T104 in meso 2 are MOST RECENT. T105/T106 are in meso 3 but have EARLIER dates
  // (out-of-order completions). Without the end-boundary cap, meso 3 trainings (micro 9, 11
  // which are >= meso 2's startMicro=5) would be included in the meso 2 range.
  const trainingsById: Record<number, Training> = {
    101: makeFinished(101, '2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z'), // meso 1, micro 1
    102: makeFinished(102, '2026-01-08T10:00:00Z', '2026-01-08T11:00:00Z'), // meso 1, micro 3
    103: makeFinished(103, '2026-02-01T10:00:00Z', '2026-02-01T11:00:00Z'), // meso 2, micro 5
    104: makeFinished(104, '2026-02-08T10:00:00Z', '2026-02-08T11:00:00Z'), // meso 2, micro 7 ← most recent
    105: makeFinished(105, '2026-01-15T10:00:00Z', '2026-01-15T11:00:00Z'), // meso 3, micro 9 (earlier date)
    106: makeFinished(106, '2026-01-20T10:00:00Z', '2026-01-20T11:00:00Z'), // meso 3, micro 11 (earlier date)
  };

  it('Meso preset on meso #2 excludes trainings from meso #1 and meso #3', () => {
    const result = computeMesoRange([plan], trainingsById);
    expect(result).not.toBeNull();
    // T104 has the most recent end date → current meso is Meso 2
    expect(result!.name).toBe('Meso 2');

    // Range must cover only meso-2 trainings (T103 start → T104 end)
    expect(result!.start.toISOString()).toBe('2026-02-01T10:00:00.000Z');
    expect(result!.end.toISOString()).toBe('2026-02-08T11:00:00.000Z');
  });
});

// ─── GH-186: Markdown rendering in assistant bubbles ──────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

jest.mock('@react-navigation/elements', () => ({
  useHeaderHeight: () => 0,
}));

// GH-293: AIChatTab now navigates to the chat history screen
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  return {
    ...actual,
    useDispatch: () => jest.fn(),
    useSelector: jest.fn(),
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {View, Text} = require('react-native');
  const mockTheme = {
    colors: {
      primary: '#6200EE',
      onPrimary: '#FFFFFF',
      surfaceVariant: '#E7E0EC',
      onSurfaceVariant: '#49454F',
      surface: '#FFFBFE',
      background: '#FFFBFE',
      onSurface: '#1C1B1F',
      errorContainer: '#F9DEDC',
      onErrorContainer: '#410E0B',
      outlineVariant: '#CAC4D0',
    },
  };
  return {
    useTheme: () => mockTheme,
    Text: ({children, testID, ...props}: any) => React.createElement(Text, {testID, ...props}, children),
    Surface: ({children, ...props}: any) => React.createElement(View, props, children),
    ActivityIndicator: () => null,
    Chip: ({children, onPress, testID}: any) => React.createElement(Text, {onPress, testID}, children),
    IconButton: () => null,
    TextInput: Object.assign(
      ({testID, ...props}: any) => React.createElement(View, {testID}),
      {Icon: () => null},
    ),
    // GH-391 added two Portal dialogs to the tab; they are covered by their own
    // suite, here they only have to mount.
    Portal: ({children}: any) => React.createElement(View, null, children),
    Button: ({children, onPress, testID}: any) => React.createElement(Text, {onPress, testID}, children),
    List: {
      Item: ({title, testID, onPress}: any) => React.createElement(Text, {testID, onPress}, title),
      Icon: () => null,
    },
    Dialog: Object.assign(({children, visible}: any) => (visible ? React.createElement(View, null, children) : null), {
      Title: ({children}: any) => React.createElement(View, null, children),
      Content: ({children}: any) => React.createElement(View, null, children),
      ScrollArea: ({children}: any) => React.createElement(View, null, children),
      Actions: ({children}: any) => React.createElement(View, null, children),
    }),
  };
});

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const {Text} = require('react-native');
  const MockMarkdown = ({children, testID}: {children: string; testID?: string}) =>
    React.createElement(Text, {testID: testID ?? 'markdown-component'}, children);
  MockMarkdown.displayName = 'Markdown';
  return {__esModule: true, default: MockMarkdown};
});

jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {
    hasAnthropicApiKey: () => true,
    getAnthropicApiKey: () => 'test-key',
  },
  subscribeToApiKeyChanges: () => () => {},
}));

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


describe('AIChatTab Markdown rendering (GH-186)', () => {
  const mockUseSelector = useSelector as jest.Mock;

  beforeEach(() => {
    mockUseSelector.mockImplementation((selector: (state: any) => any) => {
      const state = {
        aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
        trainings: {byId: {}, allIds: []},
        workouts: {byId: {}},
        exercises: {byId: {}},
        videoAnalyses: {byId: {}},
        trainingsPlan: {byId: {}, allIds: []},
        settings: {mode: 'dark'},
      };
      return selector(state);
    });
  });

  it('assistant bubble renders Markdown component, not plain Text', () => {
    mockUseSelector.mockImplementation((selector: (state: any) => any) => {
      const state = {
        aiChat: {
          messages: [{role: 'assistant', content: '# Hello\n- **item**'}],
          isLoading: false,
          error: null,
          seedContextJson: null,
          contextRange: null,
        },
        trainings: {byId: {}, allIds: []},
        workouts: {byId: {}},
        exercises: {byId: {}},
        videoAnalyses: {byId: {}},
        trainingsPlan: {byId: {}, allIds: []},
        settings: {mode: 'dark'},
      };
      return selector(state);
    });

    const AIChatTab = require('../../../app/tabs/Analyse/AIChatTab').default;
    const {queryByTestId} = render(React.createElement(AIChatTab));

    expect(queryByTestId('chat-bubble-assistant')).not.toBeNull();
    expect(queryByTestId('chat-bubble-assistant-markdown')).not.toBeNull();
    // User text node must NOT appear in an assistant bubble
    expect(queryByTestId('chat-bubble-user-text')).toBeNull();
  });

  it('user bubble renders plain Text, not Markdown', () => {
    mockUseSelector.mockImplementation((selector: (state: any) => any) => {
      const state = {
        aiChat: {
          messages: [{role: 'user', content: 'Hello AI'}],
          isLoading: false,
          error: null,
          seedContextJson: null,
          contextRange: null,
        },
        trainings: {byId: {}, allIds: []},
        workouts: {byId: {}},
        exercises: {byId: {}},
        videoAnalyses: {byId: {}},
        trainingsPlan: {byId: {}, allIds: []},
        settings: {mode: 'dark'},
      };
      return selector(state);
    });

    const AIChatTab = require('../../../app/tabs/Analyse/AIChatTab').default;
    const {queryByTestId} = render(React.createElement(AIChatTab));

    expect(queryByTestId('chat-bubble-user')).not.toBeNull();
    expect(queryByTestId('chat-bubble-user-text')).not.toBeNull();
    expect(queryByTestId('chat-bubble-assistant-markdown')).toBeNull();
  });
});
