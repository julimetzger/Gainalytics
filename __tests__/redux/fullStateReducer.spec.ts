import fullStateReducer from '../../app/redux/fullstateactions/fullStateReducer';
import {GlobalState} from '../../app/redux/rootReducer';

const baseState: Partial<GlobalState> = {
  exercises: {byId: {}, allIds: []} as any,
  workouts: {byId: {}, allIds: []} as any,
  trainingsPlan: {byId: {}, allIds: []} as any,
  trainings: {byId: {}, allIds: []} as any,
  videoAnalyses: {byId: {}, allIds: []} as any,
  settings: {} as any,
  effects: {} as any,
  aiChat: {messages: [{role: 'user', content: 'existing chat'}], isLoading: false, error: null, seedContextJson: null, contextRange: null},
};

describe('fullStateReducer FULL_IMPORT (GH-361)', () => {
  it('falls back to the current aiChat state when the imported backup predates the AI Chat feature', () => {
    const importedState = {
      exercises: {byId: {}, allIds: []},
      workouts: {byId: {}, allIds: []},
      trainingsPlan: {byId: {}, allIds: []},
      trainings: {byId: {}, allIds: []},
      settings: {},
      effects: {},
      // no `aiChat` key — simulates an older .gains export captured before GH-157 shipped
    };

    const result = fullStateReducer(baseState as GlobalState, {type: 'FULL_IMPORT', state: importedState});

    expect(result.aiChat).toEqual(baseState.aiChat);
  });

  it('uses the imported aiChat state when the backup file already contains one', () => {
    const importedAiChat = {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null};
    const importedState = {
      exercises: {byId: {}, allIds: []},
      workouts: {byId: {}, allIds: []},
      trainingsPlan: {byId: {}, allIds: []},
      trainings: {byId: {}, allIds: []},
      settings: {},
      effects: {},
      aiChat: importedAiChat,
    };

    const result = fullStateReducer(baseState as GlobalState, {type: 'FULL_IMPORT', state: importedState});

    expect(result.aiChat).toEqual(importedAiChat);
  });
});
