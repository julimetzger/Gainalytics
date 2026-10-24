import React from 'react';
import {BackHandler} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import OnboardingFlow from '../../../app/components/onboarding/OnboardingFlow';
import {PROGRAM_TEMPLATES} from '../../../app/constants/programTemplates';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

const renderFlow = () => {
  const props = {onSkip: jest.fn(), onCreateFromTemplate: jest.fn(), onEmptyPlan: jest.fn(), onImport: jest.fn()};
  const utils = render(
    <PaperProvider>
      <OnboardingFlow {...props} />
    </PaperProvider>,
  );
  return {...utils, props};
};

describe('OnboardingFlow (GH-497)', () => {
  it('walks welcome → RIR → start choice with Next and Back', () => {
    const {getByTestId, queryByTestId, getByText} = renderFlow();

    expect(getByTestId('onboarding-step-welcome')).toBeTruthy();
    expect(getByText('Step 1 of 3')).toBeTruthy();
    ['plan', 'meso', 'micro', 'training'].forEach((level) => expect(getByTestId(`onboarding-level-${level}`)).toBeTruthy());

    fireEvent.press(getByTestId('onboarding-next'));
    expect(getByTestId('onboarding-step-rir')).toBeTruthy();
    expect(getByText('Step 2 of 3')).toBeTruthy();

    fireEvent.press(getByTestId('onboarding-back'));
    expect(getByTestId('onboarding-step-welcome')).toBeTruthy();

    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));
    expect(getByTestId('onboarding-step-start')).toBeTruthy();
    expect(getByText('Step 3 of 3')).toBeTruthy();
    // The start step ends in a choice, not in "Next".
    expect(queryByTestId('onboarding-next')).toBeNull();
  });

  it('can be skipped from any step', () => {
    const {getByTestId, props} = renderFlow();
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(props.onSkip).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(props.onSkip).toHaveBeenCalledTimes(2);
  });

  it('routes "empty plan" and "import" to their callbacks', () => {
    const {getByTestId, props} = renderFlow();
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));

    fireEvent.press(getByTestId('onboarding-choice-empty'));
    fireEvent.press(getByTestId('onboarding-choice-import'));

    expect(props.onEmptyPlan).toHaveBeenCalledTimes(1);
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onCreateFromTemplate).not.toHaveBeenCalled();
  });

  it('creates the plan from the chosen template', () => {
    const {getByTestId, getByText, props} = renderFlow();
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-next'));
    fireEvent.press(getByTestId('onboarding-choice-template'));

    expect(getByTestId('onboarding-step-template')).toBeTruthy();
    PROGRAM_TEMPLATES.forEach((t) => expect(getByTestId(`program-template-${t.id}`)).toBeTruthy());
    // The first template is preselected and shows its description.
    expect(getByText(PROGRAM_TEMPLATES[0].description)).toBeTruthy();

    fireEvent.press(getByTestId('program-template-hypertrophy-block'));
    expect(getByTestId('program-template-hypertrophy-block').props.accessibilityState).toEqual(expect.objectContaining({checked: true}));
    fireEvent.press(getByTestId('onboarding-create-plan'));

    expect(props.onCreateFromTemplate).toHaveBeenCalledWith(PROGRAM_TEMPLATES[1]);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('hardware back steps back instead of leaving the onboarding', () => {
    const listeners: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      listeners.push(handler as () => boolean);
      return {remove: jest.fn()};
    });
    const {getByTestId} = renderFlow();
    fireEvent.press(getByTestId('onboarding-next'));

    let handled = false;
    act(() => {
      handled = listeners[listeners.length - 1]();
    });

    expect(handled).toBe(true);
    expect(getByTestId('onboarding-step-welcome')).toBeTruthy();
    spy.mockRestore();
  });
});
