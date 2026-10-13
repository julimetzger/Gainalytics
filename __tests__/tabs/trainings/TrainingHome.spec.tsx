import React from 'react';
import {fireEvent, render, waitFor, within} from '@testing-library/react-native';
import TrainingHome from '../../../app/tabs/trainings/TrainingHome';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {exportTrainingsPlanToFile} from '../../../app/utils/exportTrainingsPlan';
import {Alert} from 'react-native';
import Toast from 'react-native-toast-message';

const mockState = {
  trainingsPlan: {byId: {} as Record<number, TrainingsPlan>},
  settings: {} as {currentTrainingsPlanId?: number},
};
const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
  useStore: () => ({
    getState: () => mockState,
  }),
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

jest.mock('../../../app/redux/Training/use/useAllTrainingsPlans', () => ({
  useAllTrainingsPlans: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useTrainings', () => ({
  useTrainings: jest.fn(),
}));

jest.mock('../../../app/redux/Training/dispatch/general/dispatchCreatePlanFromTemplate', () => ({
  dispatchCreatePlanFromTemplate: () => jest.fn(),
}));

jest.mock('../../../app/utils/exportTrainingsPlan', () => ({
  exportTrainingsPlanToFile: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('../../../app/components/Training/dashboard/MicroHeroCard', () => {
  const React = require('react');
  const {View} = require('react-native');
  return () => React.createElement(View, {testID: 'micro-hero-card'});
});

// Surfaces the slot the dashboard picked, so a test can assert WHICH session the
// card points at (GH-401 review 2: a running session must win over plan order).
jest.mock('../../../app/components/Training/dashboard/NextTrainingCard', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  return ({plan, nextMicro, nextTrainingNum, isComplete, isEmpty}: any) =>
    React.createElement(View, {testID: 'next-training-card'}, [
      React.createElement(Text, {key: 'plan', testID: 'next-training-plan'}, plan.name),
      React.createElement(Text, {key: 'slot', testID: 'next-training-slot'}, `${nextMicro}:${nextTrainingNum}`),
      React.createElement(Text, {key: 'complete', testID: 'next-training-complete'}, String(isComplete)),
      React.createElement(Text, {key: 'empty', testID: 'next-training-empty'}, String(!!isEmpty)),
    ]);
});

jest.mock('../../../app/components/Training/dashboard/MicroRecordsCard', () => {
  const React = require('react');
  const {View} = require('react-native');
  return () => React.createElement(View, {testID: 'micro-records-card'});
});

jest.mock('../../../app/components/Training/dashboard/LastTrainingCard', () => {
  const React = require('react');
  const {View} = require('react-native');
  return () => React.createElement(View, {testID: 'last-training-card'});
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput: RNTextInput, TouchableOpacity, View} = require('react-native');
  const Dialog = ({children, visible}: any) => (visible ? <View>{children}</View> : null);
  Dialog.Title = ({children}: any) => <Text>{children}</Text>;
  Dialog.Content = ({children}: any) => <View>{children}</View>;
  Dialog.Actions = ({children}: any) => <View>{children}</View>;
  const TextInputComponent = ({value, onChangeText, testID}: any) => (
    <View>
      <Text>{value}</Text>
      {/* GH-518: typeable, so a test can create a plan through the dialog. */}
      <RNTextInput testID={testID} onChangeText={onChangeText} />
    </View>
  );
  (TextInputComponent as any).Icon = () => null;
  return {
    // GH-412: the plans search is a Searchbar now — keep it editable in the mock
    // so a test can type into it and assert the list actually filters.
    Searchbar: ({value, onChangeText, placeholder, testID, style}: any) => (
      <RNTextInput testID={testID} placeholder={placeholder} value={value} onChangeText={onChangeText} style={style} />
    ),
    Button: ({children, onPress, testID, accessibilityLabel}: any) => (
      <TouchableOpacity testID={testID || (typeof children === 'string' ? children : undefined)} onPress={onPress} accessibilityLabel={accessibilityLabel}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Snackbar: ({children, visible, action, testID}: any) =>
      visible ? (
        <View testID={testID}>
          <Text>{children}</Text>
          {action && (
            <TouchableOpacity testID={action.testID} onPress={action.onPress}>
              <Text>{action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null,
    Tooltip: ({children, title}: any) => (
      <View accessibilityHint={title} testID="tooltip">
        {children}
      </View>
    ),
    Card: ({children}: any) => <View>{children}</View>,
    Chip: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Dialog,
    // GH-428: the plan dialog renders an inline validation message.
    HelperText: ({children, visible, testID}: any) => (visible ? <Text testID={testID}>{children}</Text> : null),
    Portal: ({children}: any) => <View>{children}</View>,
    IconButton: ({onPress, testID, accessibilityLabel, accessibilityState}: any) => (
      <TouchableOpacity onPress={onPress} testID={testID} accessibilityLabel={accessibilityLabel} accessibilityState={accessibilityState}>
        <Text>IconButton</Text>
      </TouchableOpacity>
    ),
    ProgressBar: () => null,
    SegmentedButtons: () => null,
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    TextInput: TextInputComponent,
    useTheme: () => ({colors: {primary: '#000'}}),
  };
});

const mockedUseAllTrainingsPlans = require('../../../app/redux/Training/use/useAllTrainingsPlans').useAllTrainingsPlans as jest.Mock;
const mockedUseTrainings = require('../../../app/redux/Training/use/useTrainings').useTrainings as jest.Mock;
const mockedExportTrainingsPlanToFile = exportTrainingsPlanToFile as jest.Mock;

const plan: TrainingsPlan = {
  id: 1,
  name: 'Strength Plan',
  trainings: {'1:1': 10},
  trainingNames: {},
};

describe('TrainingHome', () => {
  beforeEach(() => {
    mockedUseAllTrainingsPlans.mockReturnValue([plan]);
    mockedUseTrainings.mockReturnValue([
      {
        id: 10,
        state: TrainingsState.PLANNED,
        plannedWorkouts: {},
        doneWorkoutIds: {},
        exercises: [],
      },
    ]);
    mockedExportTrainingsPlanToFile.mockResolvedValue('/downloads/plan.json');
    mockState.trainingsPlan.byId = {[plan.id]: plan};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GH-460: shows a labelled "New Training" button that opens the add-plan dialog', () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const {getByText, getByTestId, queryByText} = render(<TrainingHome navigation={navigation as any} route={{params: {}} as any} />);

    expect(getByText('New Training')).toBeTruthy();
    expect(queryByText('Add New Training Plan')).toBeNull();
    fireEvent.press(getByTestId('add-trainings-plan'));
    expect(getByText('Add New Training Plan')).toBeTruthy();
  });

  it('exports a trainings plan from the export dialog', async () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByText, getByTestId} = render(<TrainingHome navigation={navigation as any} route={route as any} />);

    fireEvent.press(getByTestId(`edit-trainings-plan-${plan.id}`));
    fireEvent.press(getByText('Export'));

    await waitFor(() => {
      expect(mockedExportTrainingsPlanToFile).toHaveBeenCalledWith(plan, expect.any(Object));
    });

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Training plan exported',
        text2: '/downloads/plan.json',
      }),
    );
  });

  it('shows an alert when export fails', async () => {
    mockedExportTrainingsPlanToFile.mockRejectedValueOnce(new Error('nope'));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByText, getByTestId} = render(<TrainingHome navigation={navigation as any} route={route as any} />);

    fireEvent.press(getByTestId(`edit-trainings-plan-${plan.id}`));
    fireEvent.press(getByText('Export'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Export failed', 'Could not export the training plan.');
    });
  });

  it('GH-311: plan meta shows total from trainingNames, not from slot count', () => {
    const planWith4Types: TrainingsPlan = {
      id: 2,
      name: 'PPL Plan',
      trainingNames: {'1': 'Push', '2': 'Pull', '3': 'Legs', '4': 'Upper'},
      trainings: {'1,1': 20},
      lastTraining: 20,
    };

    const yesterday = new Date(Date.now() - 86400000).toISOString();
    mockedUseAllTrainingsPlans.mockReturnValue([planWith4Types]);
    mockedUseTrainings.mockReturnValue([
      {
        id: 20,
        state: TrainingsState.FINISHED,
        end: yesterday,
        start: yesterday,
        plannedWorkouts: {},
        doneWorkoutIds: {},
        exercises: [],
      },
    ]);
    mockState.trainingsPlan.byId = {2: planWith4Types};

    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByTestId} = render(<TrainingHome navigation={navigation as any} route={route as any} />);

    const meta = getByTestId('plan-meta-2');
    expect(meta.props.children).toContain('1/4');
  });
});

describe('TrainingHome — GH-401 review 2: the card follows the session that is actually running', () => {
  const threeDayPlan: TrainingsPlan = {
    id: 3,
    name: 'PPL',
    trainingNames: {'1': 'Push', '2': 'Pull', '3': 'Legs'},
    trainings: {'1,1': 31, '1,2': 32, '1,3': 33},
  };

  const slot = (id: number, state: TrainingsState, extra: object = {}) => ({
    id,
    state,
    plannedWorkouts: {},
    doneWorkoutIds: {},
    exercises: [1],
    ...extra,
  });

  // The dashboard only appears for an "active" plan — one with a running session or a
  // finished last training. This variant supplies the latter, so the no-running cases
  // still render a card to assert on.
  const planWithDoneDay1: TrainingsPlan = {...threeDayPlan, lastTraining: 31};

  const renderHome = (plan: TrainingsPlan = threeDayPlan) => {
    mockedUseAllTrainingsPlans.mockReturnValue([plan]);
    mockState.trainingsPlan.byId = {3: plan};
    return render(
      <TrainingHome navigation={{setOptions: jest.fn(), navigate: jest.fn()} as any} route={{params: {}} as any} />,
    );
  };

  const yesterday = new Date(Date.now() - 86400000).toISOString();

  afterEach(() => jest.clearAllMocks());

  it('points at day 3 while it runs, even though day 1 is still open', () => {
    mockedUseTrainings.mockReturnValue([
      slot(31, TrainingsState.PLANNED),
      slot(32, TrainingsState.PLANNED),
      slot(33, TrainingsState.STARTED, {start: new Date(Date.now() - 60000).toISOString()}),
    ]);

    const {getByTestId} = renderHome();

    expect(getByTestId('next-training-slot').props.children).toBe('1:3');
  });

  it('falls back to the first undone slot once nothing is running', () => {
    mockedUseTrainings.mockReturnValue([
      slot(31, TrainingsState.FINISHED, {start: yesterday, end: yesterday}),
      slot(32, TrainingsState.PLANNED),
      slot(33, TrainingsState.PLANNED),
    ]);

    const {getByTestId} = renderHome(planWithDoneDay1);

    expect(getByTestId('next-training-slot').props.children).toBe('1:2');
  });

  it('ignores a STARTED slot that already ended, so a stale state cannot pin the card', () => {
    mockedUseTrainings.mockReturnValue([
      slot(31, TrainingsState.FINISHED, {start: yesterday, end: yesterday}),
      slot(32, TrainingsState.PLANNED),
      slot(33, TrainingsState.STARTED, {start: yesterday, end: yesterday}),
    ]);

    const {getByTestId} = renderHome(planWithDoneDay1);

    expect(getByTestId('next-training-slot').props.children).toBe('1:2');
  });

  // GH-467: deleting the last finished training leaves plan.lastTraining pointing at a training that no longer exists.
  it('falls back to the latest finished training when the last training was deleted', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    mockedUseTrainings.mockReturnValue([
      slot(31, TrainingsState.FINISHED, {start: twoDaysAgo, end: twoDaysAgo}),
      slot(32, TrainingsState.FINISHED, {start: yesterday, end: yesterday}),
    ]);

    const {getByTestId} = renderHome({...threeDayPlan, trainings: {'1,1': 31, '1,2': 32}, lastTraining: 33});

    expect(getByTestId('last-training-card')).toBeTruthy();
    expect(getByTestId('next-training-slot').props.children).toBe('1:3');
  });

  it('shows no last training when the deleted one was the only finished training', () => {
    mockedUseTrainings.mockReturnValue([slot(32, TrainingsState.PLANNED)]);

    const {queryByTestId} = renderHome({...threeDayPlan, trainings: {'1,2': 32}, lastTraining: 33});

    expect(queryByTestId('last-training-card')).toBeNull();
  });
});

// GH-412: one search entry point only — the header magnifier is gone and the
// remaining field is the Exercises-tab Searchbar, with unchanged filter behaviour.
describe('TrainingHome — GH-412 plans search', () => {
  const push: TrainingsPlan = {id: 41, name: 'Push pull', trainings: {}, trainingNames: {}};
  const upper: TrainingsPlan = {id: 42, name: 'Upper lower', trainings: {}, trainingNames: {}};

  const renderHome = () => {
    mockedUseAllTrainingsPlans.mockReturnValue([push, upper]);
    mockedUseTrainings.mockReturnValue([]);
    mockState.trainingsPlan.byId = {41: push, 42: upper};
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    return {navigation, ...render(<TrainingHome navigation={navigation as any} route={{params: {}} as any} />)};
  };

  afterEach(() => jest.clearAllMocks());

  it('never installs a headerRight search icon', () => {
    const {navigation} = renderHome();

    for (const [options] of navigation.setOptions.mock.calls) {
      expect(options).not.toHaveProperty('headerRight');
    }
  });

  it('keeps the "Search plans" placeholder on the search field', () => {
    const {getByTestId} = renderHome();

    expect(getByTestId('plans-search-field').props.placeholder).toBe('Search plans');
  });

  it('filters the plan list on match, on no match, and again after clearing', () => {
    const {getByTestId, queryByText} = renderHome();
    const field = getByTestId('plans-search-field');

    expect(queryByText('Push pull')).not.toBeNull();
    expect(queryByText('Upper lower')).not.toBeNull();

    fireEvent.changeText(field, 'upper');
    expect(queryByText('Push pull')).toBeNull();
    expect(queryByText('Upper lower')).not.toBeNull();

    fireEvent.changeText(field, 'zzz');
    expect(queryByText('Push pull')).toBeNull();
    expect(queryByText('Upper lower')).toBeNull();

    fireEvent.changeText(field, '');
    expect(queryByText('Push pull')).not.toBeNull();
    expect(queryByText('Upper lower')).not.toBeNull();
  });
});

// GH-428 (H1): plans created before the name validation existed keep an empty
// name — no migration cleans them up. They must stay readable, identifiable for
// a screenreader, and reachable for rename/delete.
describe('TrainingHome — GH-428 nameless legacy plans', () => {
  const nameless: TrainingsPlan = {id: 51, name: '', trainings: {}, trainingNames: {}};
  const named: TrainingsPlan = {id: 52, name: 'Upper lower', trainings: {}, trainingNames: {}};

  const renderHome = () => {
    mockedUseAllTrainingsPlans.mockReturnValue([nameless, named]);
    mockedUseTrainings.mockReturnValue([]);
    mockState.trainingsPlan.byId = {51: nameless, 52: named};
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    return {navigation, ...render(<TrainingHome navigation={navigation as any} route={{params: {}} as any} />)};
  };

  afterEach(() => jest.clearAllMocks());

  it('announces every row with its plan name, falling back to "Unnamed plan"', () => {
    const {getByTestId} = renderHome();

    expect(getByTestId('plan-row-51').props.accessibilityLabel).toBe('Unnamed plan, Draft · no trainings yet');
    expect(getByTestId('plan-row-52').props.accessibilityLabel).toBe('Upper lower, Draft · no trainings yet');
  });

  it('shows the fallback label instead of an empty title', () => {
    const {getByTestId} = renderHome();

    expect(getByTestId('plan-name-51').props.children).toBe('Unnamed plan');
    expect(getByTestId('plan-name-52').props.children).toBe('Upper lower');
  });

  /**
   * PR #430 review round 3, point 1: the row shows "Unnamed plan", so searching
   * for exactly that has to find it. Filtering on the raw (empty) name matched
   * every plan on any input and made the row itself unreachable by its label.
   */
  it('finds the nameless plan when searching for the label the row shows', () => {
    const {getByTestId, queryByTestId} = renderHome();

    fireEvent.changeText(getByTestId('plans-search-field'), 'unnamed');

    expect(queryByTestId('plan-name-51')).not.toBeNull();
    expect(queryByTestId('plan-name-52')).toBeNull();
  });

  it('hides the nameless plan for a search that matches neither name', () => {
    const {getByTestId, queryByTestId} = renderHome();

    fireEvent.changeText(getByTestId('plans-search-field'), 'zzz');

    expect(queryByTestId('plan-name-51')).toBeNull();
    expect(queryByTestId('plan-name-52')).toBeNull();
  });

  it('keeps the nameless plan renamable and deletable', () => {
    const {getByTestId, getByText} = renderHome();

    fireEvent.press(getByTestId('edit-trainings-plan-51'));

    expect(getByText('Edit Unnamed plan')).toBeTruthy();
    expect(getByTestId('trainings-plan-delete')).toBeTruthy();
  });
});

describe('TrainingHome — GH-497 a new plan without any training yet', () => {
  const slot = (id: number, state: TrainingsState, extra: object = {}) => ({
    id,
    state,
    plannedWorkouts: {},
    doneWorkoutIds: {},
    exercises: [1],
    ...extra,
  });
  // Micro 3, so its card (3:1 / 4:1) is distinguishable from the new plan's 1:1.
  const olderPlan: TrainingsPlan = {id: 4, name: 'Older template', trainingNames: {'1': 'A'}, trainings: {'3,1': 41}};
  const newestPlan: TrainingsPlan = {id: 5, name: 'Strength Block', trainingNames: {'1': 'Squat & Bench', '2': 'Deadlift & Press'}, trainings: {'1,1': 51, '1,2': 52}};
  const draftPlan: TrainingsPlan = {id: 6, name: 'Empty draft', trainingNames: {}, trainings: {}};

  const renderHome = (plans: TrainingsPlan[], params: object = {}, navigation = {setOptions: jest.fn(), navigate: jest.fn(), setParams: jest.fn()}) => {
    mockedUseAllTrainingsPlans.mockReturnValue(plans);
    mockState.trainingsPlan.byId = Object.fromEntries(plans.map((p) => [p.id, p]));
    return {navigation, ...render(<TrainingHome navigation={navigation as any} route={{params} as any} />)};
  };

  afterEach(() => jest.clearAllMocks());

  it('puts the newest planned plan on the dashboard so its first training is one tap away', () => {
    mockedUseTrainings.mockReturnValue([slot(41, TrainingsState.PLANNED), slot(51, TrainingsState.PLANNED), slot(52, TrainingsState.PLANNED)]);

    const {getByTestId} = renderHome([olderPlan, newestPlan, draftPlan]);

    expect(getByTestId('next-training-slot').props.children).toBe('1:1');
  });

  it('keeps the plan the user actually trains in front of a new template plan', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    mockedUseTrainings.mockReturnValue([
      slot(41, TrainingsState.FINISHED, {start: yesterday, end: yesterday}),
      slot(51, TrainingsState.PLANNED),
      slot(52, TrainingsState.PLANNED),
    ]);

    const {getByTestId} = renderHome([{...olderPlan, lastTraining: 41}, newestPlan]);

    // The trained plan continues with its next micro (4:1); the template plan would be 1:1.
    expect(getByTestId('next-training-slot').props.children).toBe('4:1');
  });

  it('shows no dashboard when only empty drafts exist', () => {
    mockedUseTrainings.mockReturnValue([]);

    const {queryByTestId} = renderHome([draftPlan]);

    expect(queryByTestId('next-training-card')).toBeNull();
  });

  it('opens the add-plan dialog once when the onboarding asks for an empty plan', () => {
    mockedUseTrainings.mockReturnValue([]);

    const {getByText, navigation} = renderHome([], {openNewPlan: true});

    expect(getByText('Add New Training Plan')).toBeTruthy();
    expect(navigation.setParams).toHaveBeenCalledWith({openNewPlan: undefined});
  });
});

describe('TrainingHome — GH-518 current plan and the "New Training" button', () => {
  const slot = (id: number, state: TrainingsState, extra: object = {}) => ({
    id,
    state,
    plannedWorkouts: {},
    doneWorkoutIds: {},
    exercises: [1],
    ...extra,
  });
  // The plan the user trains in (auto choice) vs. a newer one that has to become current.
  const trainedPlan: TrainingsPlan = {id: 7, name: 'Push pull', trainingNames: {'1': 'Push'}, trainings: {'2,1': 71}, lastTraining: 71};
  const newPlan: TrainingsPlan = {id: 8, name: 'Kraftblock', trainingNames: {'1': 'Training 1'}, trainings: {'1,1': 81}};
  const emptyPlan: TrainingsPlan = {id: 9, name: 'Fresh', trainingNames: {}, trainings: {}};
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  const renderHome = (plans: TrainingsPlan[], currentTrainingsPlanId?: number) => {
    mockedUseAllTrainingsPlans.mockReturnValue(plans);
    mockedUseTrainings.mockReturnValue([slot(71, TrainingsState.FINISHED, {start: yesterday, end: yesterday}), slot(81, TrainingsState.PLANNED)]);
    mockState.trainingsPlan.byId = Object.fromEntries(plans.map((p) => [p.id, p]));
    mockState.settings = {currentTrainingsPlanId};
    const navigation = {setOptions: jest.fn(), navigate: jest.fn(), setParams: jest.fn()};
    return render(<TrainingHome navigation={navigation as any} route={{params: {}} as any} />);
  };

  afterEach(() => {
    mockState.settings = {};
    jest.clearAllMocks();
  });

  it('keeps the automatic choice when no current plan is stored (installs from before GH-518)', () => {
    const {getByTestId, queryByTestId} = renderHome([trainedPlan, newPlan]);

    expect(getByTestId('next-training-plan').props.children).toBe('Push pull');
    expect(getByTestId('plan-current-label-7')).toBeTruthy();
    expect(queryByTestId('plan-current-label-8')).toBeNull();
  });

  it('puts the stored current plan on the dashboard instead of the plan trained last', () => {
    const {getByTestId, queryByTestId} = renderHome([trainedPlan, newPlan], 8);

    expect(getByTestId('next-training-plan').props.children).toBe('Kraftblock');
    expect(getByTestId('next-training-slot').props.children).toBe('1:1');
    expect(getByTestId('plan-current-label-8')).toBeTruthy();
    expect(queryByTestId('plan-current-label-7')).toBeNull();
  });

  it('falls back to the automatic choice when the stored plan no longer exists', () => {
    const {getByTestId} = renderHome([trainedPlan, newPlan], 99);

    expect(getByTestId('next-training-plan').props.children).toBe('Push pull');
  });

  it('shows an empty current plan as "not planned yet", never as complete and never the old plan', () => {
    const {getByTestId} = renderHome([trainedPlan, emptyPlan], 9);

    expect(getByTestId('next-training-plan').props.children).toBe('Fresh');
    expect(getByTestId('next-training-empty').props.children).toBe('true');
    expect(getByTestId('next-training-complete').props.children).toBe('false');
  });

  it('labels the star for screen readers and as a tooltip', () => {
    const {getByTestId, getAllByTestId} = renderHome([trainedPlan, newPlan], 8);

    expect(getByTestId('plan-select-8').props.accessibilityLabel).toBe('Current plan: Kraftblock');
    expect(getByTestId('plan-select-7').props.accessibilityLabel).toBe('Set Push pull as current plan');
    expect(getAllByTestId('tooltip').map((t) => t.props.accessibilityHint)).toEqual(['Current plan', 'Set as current plan']); // sorted: Kraftblock, Push pull
  });

  it('switches the current plan with the star and confirms it in a snackbar', () => {
    const {getByTestId, getByText, queryByTestId} = renderHome([trainedPlan, newPlan]);
    expect(queryByTestId('current-plan-snackbar')).toBeNull();

    fireEvent.press(getByTestId('plan-select-8'));

    expect(mockDispatch).toHaveBeenCalledWith({type: 'SET_CURRENT_TRAININGS_PLAN', trainingsPlanId: 8});
    expect(getByText('Kraftblock is now your current plan')).toBeTruthy();
  });

  it('does not switch away when the star of the current plan is tapped again', () => {
    const {getByTestId, getByText} = renderHome([trainedPlan, newPlan], 8);

    fireEvent.press(getByTestId('plan-select-8'));

    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: 'SET_CURRENT_TRAININGS_PLAN'}));
    expect(getByText('Kraftblock is your current plan')).toBeTruthy();
  });

  it('confirms a newly created plan as current and offers Undo back to the previous one', () => {
    const {getByTestId, getByText} = renderHome([trainedPlan, newPlan], 7);

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), 'Hypertrophy');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(mockDispatch).toHaveBeenCalledWith({type: 'ADD_TRAININGS_PLAN', trainingsPlan: {name: 'Hypertrophy'}});
    expect(getByText('Hypertrophy is now your current plan')).toBeTruthy();

    fireEvent.press(getByTestId('current-plan-snackbar-undo'));
    expect(mockDispatch).toHaveBeenCalledWith({type: 'SET_CURRENT_TRAININGS_PLAN', trainingsPlanId: 7});
  });

  it('puts "New Training" in the Plans header above the search, in the flow of the list', () => {
    const {getByTestId} = renderHome([trainedPlan, newPlan]);

    const header = getByTestId('plans-header');
    expect(within(header).getByText('Plans')).toBeTruthy();
    expect(within(header).getByTestId('add-trainings-plan').props.accessibilityLabel).toBe('New Training');
    expect(within(header).getByText('New Training')).toBeTruthy();
    // Nothing floats beside the list any more: the button scrolls with the header.
    expect(within(getByTestId('training-home-list')).getByTestId('add-trainings-plan')).toBeTruthy();
  });
});
