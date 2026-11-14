import React from 'react';
import {BackHandler} from 'react-native';
import {act, fireEvent, render, within} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import OnboardingFlow from '../../../app/components/onboarding/OnboardingFlow';
import {PROGRAM_TEMPLATES} from '../../../app/constants/programTemplates';
import {BOTTOM_TABS} from '../../../app/routing/bottomTabs';

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

type Utils = ReturnType<typeof renderFlow>;

const selectedDots = ({getByTestId}: Utils) => [0, 1, 2, 3].map((i) => getByTestId(`onboarding-dot-${i}`).props.accessibilityState.selected);

/** Simulates a swipe that settles on `page` (the pager reads the offset of the momentum end). */
const swipeTo = ({getByTestId}: Utils, page: number, width = 750) => {
  const pager = getByTestId('onboarding-pager');
  fireEvent(pager, 'layout', {nativeEvent: {layout: {width, height: 1000, x: 0, y: 0}}});
  fireEvent(pager, 'momentumScrollEnd', {nativeEvent: {contentOffset: {x: page * width, y: 0}}});
};

const goToStart = ({getByTestId}: Utils) => {
  fireEvent.press(getByTestId('onboarding-next'));
  fireEvent.press(getByTestId('onboarding-next'));
  fireEvent.press(getByTestId('onboarding-next'));
};

describe('OnboardingFlow (GH-497, GH-693)', () => {
  it('shows the four cards as pages of one swipeable pager', () => {
    const utils = renderFlow();
    const {getByTestId} = utils;
    // All cards are mounted side by side, so they can be swiped.
    ['welcome', 'navigation', 'optional', 'start'].forEach((s) => expect(getByTestId(`onboarding-step-${s}`)).toBeTruthy());
    expect(getByTestId('onboarding-pager').props.pagingEnabled).toBe(true);
    expect(getByTestId('onboarding-pager').props.horizontal).toBe(true);
    expect(selectedDots(utils)).toEqual([true, false, false, false]);
  });

  it('moves the dots and the step label with a swipe', () => {
    const utils = renderFlow();
    const {getByText} = utils;
    expect(getByText('Step 1 of 4')).toBeTruthy();

    swipeTo(utils, 1);
    expect(getByText('Step 2 of 4')).toBeTruthy();
    expect(selectedDots(utils)).toEqual([false, true, false, false]);

    swipeTo(utils, 3);
    expect(getByText('Step 4 of 4')).toBeTruthy();
    expect(selectedDots(utils)).toEqual([false, false, false, true]);

    swipeTo(utils, 2);
    expect(getByText('Step 3 of 4')).toBeTruthy();
    expect(selectedDots(utils)).toEqual([false, false, true, false]);
  });

  it('walks the cards with Next and Back', () => {
    const utils = renderFlow();
    const {getByTestId, queryByTestId, getByText} = utils;

    fireEvent.press(getByTestId('onboarding-next'));
    expect(getByText('Step 2 of 4')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-back'));
    expect(getByText('Step 1 of 4')).toBeTruthy();

    goToStart(utils);
    expect(getByText('Step 4 of 4')).toBeTruthy();
    expect(selectedDots(utils)).toEqual([false, false, false, true]);
    // The start step ends in a choice, not in "Next".
    expect(queryByTestId('onboarding-next')).toBeNull();
  });

  it('explains the app on the first card', () => {
    const {getByTestId} = renderFlow();
    ['local', 'tracking', 'analytics', 'video', 'modifications'].forEach((f) => expect(getByTestId(`onboarding-feature-${f}`)).toBeTruthy());
  });

  it('shows the bottom tabs with the labels and icons of the nav bar', () => {
    const {getByTestId} = renderFlow();
    (Object.keys(BOTTOM_TABS) as Array<keyof typeof BOTTOM_TABS>).forEach((key) => {
      const row = within(getByTestId(`onboarding-nav-${key}`));
      expect(row.getByText(BOTTOM_TABS[key].label)).toBeTruthy();
      // The very icon name the tab navigator uses.
      expect(row.UNSAFE_getAllByProps({source: BOTTOM_TABS[key].icon}).length).toBeGreaterThan(0);
    });
    expect(BOTTOM_TABS).toEqual({
      training: {label: 'Training', icon: 'book-open-variant'},
      exercises: {label: 'Exercises', icon: 'weight-lifter'},
      analyse: {label: 'Analysis', icon: 'trending-up'},
      settings: {label: 'Settings', icon: 'cog'},
    });
  });

  it('lists the AI coach among the optional features', () => {
    const {getByTestId} = renderFlow();
    expect(within(getByTestId('onboarding-optional-ai')).getByText('AI coach')).toBeTruthy();
  });

  it('can be skipped from any step; on the start choice Skip is the highlighted footer button', () => {
    const utils = renderFlow();
    const {getByTestId, getAllByTestId, props} = utils;
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(props.onSkip).toHaveBeenCalledTimes(1);

    goToStart(utils);
    // Only one Skip is rendered there: the contained one in the footer.
    expect(getAllByTestId('onboarding-skip')).toHaveLength(1);
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(props.onSkip).toHaveBeenCalledTimes(2);
  });

  it('routes "empty plan" and "import" to their callbacks', () => {
    const utils = renderFlow();
    const {getByTestId, props} = utils;
    goToStart(utils);

    fireEvent.press(getByTestId('onboarding-choice-empty'));
    fireEvent.press(getByTestId('onboarding-choice-import'));

    expect(props.onEmptyPlan).toHaveBeenCalledTimes(1);
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onCreateFromTemplate).not.toHaveBeenCalled();
  });

  it('creates the plan from the chosen template', () => {
    const utils = renderFlow();
    const {getByTestId, getByText, props} = utils;
    swipeTo(utils, 3);
    fireEvent.press(getByTestId('onboarding-choice-template'));

    expect(getByTestId('onboarding-step-template')).toBeTruthy();
    expect(getByText('Templates')).toBeTruthy();
    PROGRAM_TEMPLATES.forEach((t) => expect(getByTestId(`program-template-${t.id}`)).toBeTruthy());
    // The first template is preselected and shows its description.
    expect(getByText(PROGRAM_TEMPLATES[0].description)).toBeTruthy();

    fireEvent.press(getByTestId('program-template-hypertrophy-block'));
    expect(getByTestId('program-template-hypertrophy-block').props.accessibilityState).toEqual(expect.objectContaining({checked: true}));
    fireEvent.press(getByTestId('onboarding-create-plan'));

    expect(props.onCreateFromTemplate).toHaveBeenCalledWith(PROGRAM_TEMPLATES[1]);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('Back from the templates returns to the start choice', () => {
    const utils = renderFlow();
    const {getByTestId, getByText} = utils;
    goToStart(utils);
    fireEvent.press(getByTestId('onboarding-choice-template'));
    fireEvent.press(getByTestId('onboarding-back'));
    expect(getByText('Step 4 of 4')).toBeTruthy();
    expect(selectedDots(utils)).toEqual([false, false, false, true]);
  });

  it('hardware back steps back instead of leaving the onboarding', () => {
    const listeners: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
      listeners.push(handler as () => boolean);
      return {remove: jest.fn()};
    });
    const {getByTestId, getByText} = renderFlow();
    fireEvent.press(getByTestId('onboarding-next'));

    let handled = false;
    act(() => {
      handled = listeners[listeners.length - 1]();
    });

    expect(handled).toBe(true);
    expect(getByText('Step 1 of 4')).toBeTruthy();
    spy.mockRestore();
  });
});
