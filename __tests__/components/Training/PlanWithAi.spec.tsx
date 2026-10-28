import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import PlanWithAi from '../../../app/components/Training/PlanWithAi';
import {AI_PLAN_ECHO_API_KEY} from '../../../app/utils/ai/planTraining/requestAiPlan';

const mockPlanTraining = jest.fn();
jest.mock('../../../app/redux/Training/dispatch/plan/usePlanFromAi', () => ({
  usePlanFromAi: () => ({
    base: [{exerciseId: 1, sets: [{index: 1, reps: 8, rir: 2, weight: 100}]}],
    planTraining: mockPlanTraining,
  }),
}));

jest.mock('../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: () => [
    {id: 1, name: 'Bench Press'},
    {id: 3, name: 'Dumbbell Bench Press'},
  ],
}));
jest.mock('../../../app/redux/settings/use/useAiProvider', () => ({useAiProvider: () => 'claude'}));
jest.mock('../../../app/redux/settings/use/useAnthropicModel', () => ({useAnthropicModel: () => 'claude-haiku-4-5-20251001'}));
jest.mock('../../../app/redux/settings/use/useChatGptModel', () => ({useChatGptModel: () => undefined}));

const mockGetApiKey = jest.fn<string | undefined, []>(() => AI_PLAN_ECHO_API_KEY);
jest.mock('../../../app/utils/secureStorage', () => ({
  secureStorage: {getAnthropicApiKey: () => mockGetApiKey()},
}));

jest.mock('react-native-toast-message', () => ({__esModule: true, default: {show: jest.fn()}}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const renderBlock = () => render(<PlanWithAi trainingsPlanId={5} trainingInMicro={1} micro={6} />);

describe('PlanWithAi (GH-544)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApiKey.mockReturnValue(AI_PLAN_ECHO_API_KEY);
  });

  it('plans a valid answer directly and shows the explanation', async () => {
    const screen = renderBlock();
    const answer = JSON.stringify({
      explanation: 'Dumbbell bench press instead of bench press.',
      exercises: [{exercise_id: 3, sets: [{reps: 10, weight: 30, rir: 1}]}],
    });

    fireEvent.changeText(screen.getByTestId('plan-with-ai-input'), answer);
    fireEvent.press(screen.getByTestId('plan-with-ai-button'));

    await waitFor(() => expect(mockPlanTraining).toHaveBeenCalledTimes(1));
    expect(mockPlanTraining).toHaveBeenCalledWith([{exerciseId: 3, sets: [{index: 1, reps: 10, weight: 30, rir: 1}]}]);
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'multilineInfo',
      text1: 'Planned with AI',
      text2: 'Dumbbell bench press instead of bench press.',
      position: 'top',
      visibilityTime: 8000,
    });
    expect(screen.queryByTestId('plan-with-ai-error')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the training unplanned and says why when the answer is unusable', async () => {
    const screen = renderBlock();

    fireEvent.changeText(screen.getByTestId('plan-with-ai-input'), 'RIR -1 on everything');
    fireEvent.press(screen.getByTestId('plan-with-ai-button'));

    await waitFor(() => expect(screen.getByTestId('plan-with-ai-error')).toBeTruthy());
    expect(screen.getByTestId('plan-with-ai-error').props.children).toBe(
      'The AI answer contained no readable plan (no valid JSON).',
    );
    expect(mockPlanTraining).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('says that no AI is configured without a key', async () => {
    mockGetApiKey.mockReturnValue(undefined);
    const screen = renderBlock();

    fireEvent.changeText(screen.getByTestId('plan-with-ai-input'), 'RIR -1 on everything');
    fireEvent.press(screen.getByTestId('plan-with-ai-button'));

    await waitFor(() => expect(screen.getByTestId('plan-with-ai-error')).toBeTruthy());
    expect(screen.getByTestId('plan-with-ai-error').props.children).toBe(
      'No AI configured. Add an Anthropic API key or sign in to ChatGPT in Settings → AI Configuration.',
    );
    expect(mockPlanTraining).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends the base, the exercise list and the text to Claude with the forced plan tool', async () => {
    mockGetApiKey.mockReturnValue('sk-ant-real');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              name: 'plan_training',
              input: {explanation: 'RIR -1.', exercises: [{exercise_id: 1, sets: [{reps: 8, weight: 100, rir: 1}]}]},
            },
          ],
        }),
    });
    const screen = renderBlock();

    fireEvent.changeText(screen.getByTestId('plan-with-ai-input'), 'RIR -1 on everything');
    fireEvent.press(screen.getByTestId('plan-with-ai-button'));

    await waitFor(() => expect(mockPlanTraining).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect({tool_choice: body.tool_choice, user: JSON.parse(body.messages[0].content)}).toEqual({
      tool_choice: {type: 'tool', name: 'plan_training'},
      user: {
        base_training: {exercises: [{exercise_id: 1, name: 'Bench Press', sets: [{reps: 8, weight: 100, rir: 2}]}]},
        available_exercises: [
          {id: 1, name: 'Bench Press'},
          {id: 3, name: 'Dumbbell Bench Press'},
        ],
        user_request: 'RIR -1 on everything',
      },
    });
    expect(mockPlanTraining).toHaveBeenCalledWith([{exerciseId: 1, sets: [{index: 1, reps: 8, weight: 100, rir: 1}]}]);
  });
});
