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
  const {Text, TouchableOpacity, View} = require('react-native');
  const Dialog = ({children, visible}: any) => (visible ? <View>{children}</View> : null);
  Dialog.Title = ({children}: any) => <Text>{children}</Text>;
  Dialog.Content = ({children}: any) => <View>{children}</View>;
  Dialog.Actions = ({children}: any) => <View>{children}</View>;
  const TextInputComponent = ({value}: any) => <Text>{value}</Text>;
  (TextInputComponent as any).Icon = () => null;
  return {
    Button: ({children, onPress, testID, mode}: any) => (
      <TouchableOpacity testID={testID || (typeof children === 'string' ? children : undefined)} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Card: ({children}: any) => <View>{children}</View>,
    Chip: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Dialog,
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
