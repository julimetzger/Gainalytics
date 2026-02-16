import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import TrainingHome from '../../../app/tabs/trainings/TrainingHome';
import {TrainingsPlan} from '../../../app/models/TrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {exportTrainingsPlanToFile} from '../../../app/utils/exportTrainingsPlan';
import {Alert} from 'react-native';
import Toast from 'react-native-toast-message';

jest.mock('react-redux', () => ({
  useStore: () => ({
    getState: () => ({}),
  }),
  useDispatch: () => jest.fn(),
  useSelector: (selector: (state: any) => any) =>
    selector({
      trainingsPlan: {byId: {}},
    }),
}));

jest.mock('../../../app/redux/Training/use/useAllTrainingsPlans', () => ({
  useAllTrainingsPlans: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useTrainings', () => ({
  useTrainings: jest.fn(),
}));

jest.mock('../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('../../../app/utils/exportTrainingsPlan', () => ({
  exportTrainingsPlanToFile: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const Dialog = ({children}: any) => <View>{children}</View>;
  Dialog.Title = ({children}: any) => <Text>{children}</Text>;
  Dialog.Content = ({children}: any) => <View>{children}</View>;
  Dialog.Actions = ({children}: any) => <View>{children}</View>;
  return {
    Button: ({children, onPress, testID, mode}: any) => (
      <TouchableOpacity testID={testID || (typeof children === 'string' ? children : undefined)} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Card: ({children}: any) => <View>{children}</View>,
    Dialog,
    Portal: ({children}: any) => <View>{children}</View>,
    IconButton: ({onPress}: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>IconButton</Text>
      </TouchableOpacity>
    ),
    ProgressBar: () => null,
    Text: ({children}: any) => <Text>{children}</Text>,
    TextInput: ({value}: any) => <Text>{value}</Text>,
    useTheme: () => ({colors: {primary: '#000'}}),
  };
});

const mockedUseAllTrainingsPlans = require('../../../app/redux/Training/use/useAllTrainingsPlans').useAllTrainingsPlans as jest.Mock;
const mockedUseTrainings = require('../../../app/redux/Training/use/useTrainings').useTrainings as jest.Mock;
const mockedUseSettings = require('../../../app/redux/settings/use/useSettings').useSettings as jest.Mock;
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
    mockedUseSettings.mockReturnValue({toggles: {showPlusButtonLeft: false}});
    mockedExportTrainingsPlanToFile.mockResolvedValue('/downloads/plan.json');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exports a trainings plan from the export button', async () => {
    const navigation = {setOptions: jest.fn(), navigate: jest.fn()};
    const route = {params: {}};

    const {getByText} = render(<TrainingHome navigation={navigation as any} route={route as any} />);

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

    const {getByText} = render(<TrainingHome navigation={navigation as any} route={route as any} />);

    fireEvent.press(getByText('Export'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Export failed', 'Could not export the training plan.');
    });
  });
});
