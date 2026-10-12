import React from 'react';
import {Keyboard} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import AddTrainingsPlan from '../../../../app/components/Training/add/AddTrainingsPlan';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';
import {PROGRAM_TEMPLATES} from '../../../../app/constants/programTemplates';

const mockAddTrainingsPlan = jest.fn();
const mockEditTrainingsPlan = jest.fn();
const mockDeleteTrainingsPlan = jest.fn();
const mockImportTrainingsPlan = jest.fn();
const mockCreatePlanFromTemplate = jest.fn();

let mockTrainingsPlan: TrainingsPlan | undefined;

jest.mock('react-redux', () => ({
  useStore: () => ({getState: () => ({settings: {toggles: {}}})}),
  useDispatch: () => jest.fn(),
  useSelector: (selector: (state: any) => any) => selector({settings: {toggles: {}}}),
}));

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchAddTrainingsPlan', () => ({
  dispatchAddTrainingsPlan: () => mockAddTrainingsPlan,
}));

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchEditTrainingsPlan', () => ({
  dispatchEditTrainingsPlan: () => mockEditTrainingsPlan,
}));

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchDeleteTrainingsPlan', () => ({
  dispatchDeleteTrainingsPlan: () => mockDeleteTrainingsPlan,
}));

jest.mock('../../../../app/redux/fullstateactions/dispatchImportTrainingsPlan', () => ({
  useDispatchImportTrainingsPlan: () => mockImportTrainingsPlan,
}));

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchCreatePlanFromTemplate', () => ({
  dispatchCreatePlanFromTemplate: () => mockCreatePlanFromTemplate,
}));

jest.mock('../../../../app/redux/Training/use/useTrainingsPlan', () => ({
  useTrainingsPlan: () => mockTrainingsPlan,
}));

jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  types: {allFiles: '*/*'},
  isCancel: () => false,
}));

jest.mock('react-native-fs', () => ({readFile: jest.fn()}));

jest.mock('react-native-toast-message', () => ({show: jest.fn()}));

// Paper's HelperText keeps its text mounted and only animates opacity, so a
// plain text query cannot tell "shown" from "hidden". Everything else stays the
// real Paper implementation; only this one component is swapped for a version
// that honours `visible` by unmounting.
jest.mock('react-native-paper', () => {
  const React = require('react');
  const actual = jest.requireActual('react-native-paper');
  const {Text} = require('react-native');
  return {
    ...actual,
    HelperText: ({children, visible, testID}: any) => (visible ? <Text testID={testID}>{children}</Text> : null),
  };
});

const ERROR_TEXT = 'Please enter a name for the training plan.';

const renderAdd = () => render(
  <PaperProvider>
    <AddTrainingsPlan />
  </PaperProvider>,
);

const renderEdit = (trainingsId: number) => render(
  <PaperProvider>
    <AddTrainingsPlan trainingsId={trainingsId} />
  </PaperProvider>,
);

describe('AddTrainingsPlan — GH-428 (H1) plan name is required', () => {
  beforeEach(() => {
    mockTrainingsPlan = undefined;
    jest.clearAllMocks();
  });

  it('does not create a plan when Save is pressed with an empty name', () => {
    const {getByTestId, queryByText} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    expect(queryByText(ERROR_TEXT)).toBeNull();

    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockAddTrainingsPlan).not.toHaveBeenCalled();
    // The dialog stays open with a readable reason instead of closing silently.
    expect(queryByText(ERROR_TEXT)).not.toBeNull();
    expect(getByTestId('plan-name-input')).toBeTruthy();
  });

  it('rejects a whitespace-only name too', () => {
    const {getByTestId, queryByText} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), '   ');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockAddTrainingsPlan).not.toHaveBeenCalled();
    expect(queryByText(ERROR_TEXT)).not.toBeNull();
  });

  it('clears the message as soon as the user starts typing', () => {
    const {getByTestId, queryByText} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.press(getByTestId('confirm-trainings-plan'));
    expect(queryByText(ERROR_TEXT)).not.toBeNull();

    fireEvent.changeText(getByTestId('plan-name-input'), 'P');

    expect(queryByText(ERROR_TEXT)).toBeNull();
  });

  it('creates the plan with the trimmed name once one is entered', () => {
    const {getByTestId, queryByText} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), '  Audit R2  ');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockAddTrainingsPlan).toHaveBeenCalledWith({name: 'Audit R2'});
    expect(queryByText(ERROR_TEXT)).toBeNull();
  });

  it('blocks renaming an existing plan to an empty name', () => {
    mockTrainingsPlan = {id: 7, name: 'Upper lower', trainings: {}, trainingNames: {}};
    const {getByTestId, queryByText} = renderEdit(7);

    fireEvent.press(getByTestId('edit-trainings-plan-7'));
    fireEvent.changeText(getByTestId('plan-name-input'), '');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockEditTrainingsPlan).not.toHaveBeenCalled();
    expect(queryByText(ERROR_TEXT)).not.toBeNull();
  });

  it('lets a legacy nameless plan be renamed and deleted', () => {
    mockTrainingsPlan = {id: 8, name: '', trainings: {}, trainingNames: {}};
    const {getByTestId, getByText} = renderEdit(8);

    fireEvent.press(getByTestId('edit-trainings-plan-8'));

    // Reads "Edit Unnamed plan", not "Edit ".
    expect(getByText('Edit Unnamed plan')).toBeTruthy();

    fireEvent.changeText(getByTestId('plan-name-input'), 'Recovered plan');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockEditTrainingsPlan).toHaveBeenCalledWith(8, 'Recovered plan');
  });

  it('deletes a legacy nameless plan from a confirmation that names it', () => {
    mockTrainingsPlan = {id: 9, name: '', trainings: {}, trainingNames: {}};
    const {getByTestId, getByText} = renderEdit(9);

    fireEvent.press(getByTestId('edit-trainings-plan-9'));
    fireEvent.press(getByTestId('trainings-plan-delete'));

    expect(getByText('Delete Unnamed plan')).toBeTruthy();

    fireEvent.press(getByTestId('trainings-plan-delete-confirm'));

    expect(mockDeleteTrainingsPlan).toHaveBeenCalledWith(9);
  });
});

describe('AddTrainingsPlan — saving a new plan (GH-436 usability walk)', () => {
  let dismiss: jest.SpyInstance;

  beforeEach(() => {
    mockTrainingsPlan = undefined;
    jest.clearAllMocks();
    jest.useFakeTimers();
    dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  });

  afterEach(() => {
    dismiss.mockRestore();
    jest.useRealTimers();
  });

  // Paper's Dialog unmounts its children only when its exit animation ends, so
  // "the dialog closed" has to be observed after that animation is driven to
  // completion. Real timers make this a race that loses under a loaded suite.
  const settleExitAnimation = () => act(() => {
    jest.advanceTimersByTime(2000);
  });

  it('closes the keyboard together with the dialog so the plan list is visible again', () => {
    const {getByTestId, queryByTestId} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), 'UX436');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(mockAddTrainingsPlan).toHaveBeenCalledWith({name: 'UX436'});
    settleExitAnimation();
    expect(queryByTestId('plan-name-input')).toBeNull();
  });

  // The two fixes meet here: GH-428 keeps the dialog open when the name is
  // missing, GH-436 dismisses the keyboard on save. Dismissing in the error case
  // too would push the keyboard away from a dialog the user still has to finish.
  it('keeps the keyboard up when the name is missing so the user can keep typing', () => {
    const {getByTestId, queryByText} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(dismiss).not.toHaveBeenCalled();
    expect(mockAddTrainingsPlan).not.toHaveBeenCalled();
    expect(queryByText(ERROR_TEXT)).not.toBeNull();
    expect(getByTestId('plan-name-input')).toBeTruthy();
  });

  it('keeps the keyboard up for a whitespace-only name as well', () => {
    const {getByTestId} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), '   ');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(dismiss).not.toHaveBeenCalled();
    expect(getByTestId('plan-name-input')).toBeTruthy();
  });

  it('dismisses the keyboard only after a rejected name is corrected', () => {
    const {getByTestId, queryByTestId} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.press(getByTestId('confirm-trainings-plan'));
    expect(dismiss).not.toHaveBeenCalled();

    fireEvent.changeText(getByTestId('plan-name-input'), 'Second try');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(mockAddTrainingsPlan).toHaveBeenCalledWith({name: 'Second try'});
    settleExitAnimation();
    expect(queryByTestId('plan-name-input')).toBeNull();
  });
});

describe('AddTrainingsPlan — GH-497 empty or from template', () => {
  beforeEach(() => {
    mockTrainingsPlan = undefined;
    jest.clearAllMocks();
  });

  it('creates an empty plan by default', () => {
    const {getByTestId, queryByTestId} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    expect(queryByTestId('program-template-strength-block')).toBeNull();
    fireEvent.changeText(getByTestId('plan-name-input'), 'My plan');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockAddTrainingsPlan).toHaveBeenCalledWith({name: 'My plan'});
    expect(mockCreatePlanFromTemplate).not.toHaveBeenCalled();
  });

  it('creates the plan from the picked template, named after it unless renamed', () => {
    const {getByTestId} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.press(getByTestId('plan-source-template'));
    // Nothing picked yet → nothing is created.
    fireEvent.press(getByTestId('confirm-trainings-plan'));
    expect(mockCreatePlanFromTemplate).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('program-template-full-body-starter'));
    expect(getByTestId('plan-name-input').props.value).toBe('Full Body Starter');
    fireEvent.press(getByTestId('program-template-strength-block'));
    expect(getByTestId('plan-name-input').props.value).toBe('Strength Block');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockCreatePlanFromTemplate).toHaveBeenCalledWith(PROGRAM_TEMPLATES[0], 'Strength Block');
    expect(mockAddTrainingsPlan).not.toHaveBeenCalled();
  });

  it('keeps a name the user typed when a template is picked', () => {
    const {getByTestId} = renderAdd();

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), 'Winter block');
    fireEvent.press(getByTestId('plan-source-template'));
    fireEvent.press(getByTestId('program-template-hypertrophy-block'));
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockCreatePlanFromTemplate).toHaveBeenCalledWith(PROGRAM_TEMPLATES[1], 'Winter block');
  });

  it('opens once when the onboarding requests it', () => {
    const onHandled = jest.fn();
    const {getByTestId} = render(
      <PaperProvider>
        <AddTrainingsPlan openRequested onOpenRequestHandled={onHandled} />
      </PaperProvider>,
    );

    expect(getByTestId('plan-name-input')).toBeTruthy();
    expect(onHandled).toHaveBeenCalledTimes(1);
  });
});
