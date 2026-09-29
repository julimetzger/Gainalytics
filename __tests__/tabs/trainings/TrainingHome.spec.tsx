import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import TrainingHome from '../../../app/tabs/trainings/TrainingHome';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {exportTrainingsPlanToFile} from '../../../app/utils/exportTrainingsPlan';
import {Alert} from 'react-native';
import Toast from 'react-native-toast-message';

const mockState = {
  trainingsPlan: {byId: {} as Record<number, TrainingsPlan>},
};

jest.mock('react-redux', () => ({
  useStore: () => ({
    getState: () => mockState,
  }),
  useDispatch: () => jest.fn(),
  useSelector: (selector: (state: any) => any) => selector(mockState),
}));

jest.mock('../../../app/redux/Training/use/useAllTrainingsPlans', () => ({
  useAllTrainingsPlans: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useTrainings', () => ({
  useTrainings: jest.fn(),
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
  return ({nextMicro, nextTrainingNum, isComplete}: any) =>
    React.createElement(View, {testID: 'next-training-card'}, [
      React.createElement(Text, {key: 'slot', testID: 'next-training-slot'}, `${nextMicro}:${nextTrainingNum}`),
      React.createElement(Text, {key: 'complete', testID: 'next-training-complete'}, String(isComplete)),
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
  const TextInputComponent = ({value}: any) => <Text>{value}</Text>;
  (TextInputComponent as any).Icon = () => null;
  return {
    // GH-412: the plans search is a Searchbar now — keep it editable in the mock
    // so a test can type into it and assert the list actually filters.
    Searchbar: ({value, onChangeText, placeholder, testID, style}: any) => (
      <RNTextInput testID={testID} placeholder={placeholder} value={value} onChangeText={onChangeText} style={style} />
    ),
    Button: ({children, onPress, testID, mode}: any) => (
      <TouchableOpacity testID={testID || (typeof children === 'string' ? children : undefined)} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    // GH-460: the new-plan button is an extended FAB with a label
    FAB: ({label, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{label}</Text>
      </TouchableOpacity>
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
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity onPress={onPress} testID={testID}>
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
