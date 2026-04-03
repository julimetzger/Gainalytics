import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import TrainingsPlanTab from '../../../app/tabs/trainings/TrainingsPlanTab';
import {useTrainingsPlan} from '../../../app/redux/Training/use/useTrainingsPlan';
import {useTrainingInTrainingsPlan} from '../../../app/redux/Training/use/useTrainingInTrainingsPlan';
import dispatchChangeTrainingsName from '../../../app/redux/Training/dispatch/general/dispatchChangeTrainingsName';

const mockChangeTrainingsName = jest.fn();

jest.mock('../../../app/redux/Training/use/useTrainingsPlan', () => ({
  useTrainingsPlan: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useTrainingInTrainingsPlan', () => ({
  useTrainingInTrainingsPlan: jest.fn(),
}));

jest.mock('../../../app/redux/Training/dispatch/general/dispatchChangeTrainingsName', () => jest.fn(() => mockChangeTrainingsName));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchAddMeso', () => jest.fn(() => jest.fn()));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchEditMeso', () => jest.fn(() => jest.fn()));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchDeleteMeso', () => jest.fn(() => jest.fn()));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');
  return {
    IconButton: ({icon, onPress}: {icon: string; onPress?: () => void}) => (
      <TouchableOpacity testID={`icon-${icon}`} onPress={onPress}>
        <Text>{icon}</Text>
      </TouchableOpacity>
    ),
    useTheme: () => ({
      colors: {
        background: '#fff',
        onSecondaryContainer: '#000',
      },
    }),
  };
});

jest.mock('react-native-drawer-layout', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  return {
    Drawer: ({open, onOpen, onClose, renderDrawerContent, children}: {open: boolean; onOpen: () => void; onClose: () => void; renderDrawerContent: () => React.ReactNode; children: React.ReactNode}) => (
      <View>
        <Text testID="drawer-open-state">{open ? 'open' : 'closed'}</Text>
        <TouchableOpacity testID="drawer-open" onPress={onOpen}>
          <Text>Open Drawer</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="drawer-close" onPress={onClose}>
          <Text>Close Drawer</Text>
        </TouchableOpacity>
        <View testID="drawer-content">{renderDrawerContent()}</View>
        {children}
      </View>
    ),
  };
});

jest.mock('../../../app/components/Training/TrainingsPlanHeader', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return ({trainingsPlanName, trainingName, mode, micro, localMicro, drawerMenu}: {trainingsPlanName: string; trainingName: string; mode: string; micro: number; localMicro: number; drawerMenu: React.ReactNode}) => (
    <View>
      <Text testID="header-plan-name">{trainingsPlanName}</Text>
      <Text testID="header-training-name">{trainingName}</Text>
      <Text testID="header-mode">{mode}</Text>
      <Text testID="header-micro">{String(micro)}</Text>
      {drawerMenu}
    </View>
  );
});

jest.mock('../../../app/components/Training/TrainingsPlanDrawer', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({handleValueChange}: {handleValueChange: (value: string) => void}) => (
    <View>
      <Text>Drawer Content</Text>
      <TouchableOpacity
        testID="drawer-micro-plus"
        onPress={() => {
          handleValueChange('micro + 1');
        }}
      >
        <Text>Micro Plus</Text>
      </TouchableOpacity>
    </View>
  );
});

jest.mock('../../../app/components/Training/TrainingsPlanNode', () => {
  const React = require('react');
  const {Text} = require('react-native');

  return ({micro}: {micro: number}) => <Text testID="node-micro">{String(micro)}</Text>;
});

jest.mock('../../../app/components/RangeSwiper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({startValue, nodeFunction, onUpdateCurrentIndex}: {startValue: number; nodeFunction: (value: number, setRange: (value: number) => void) => React.ReactNode; onUpdateCurrentIndex: (index: number) => void}) => (
    <View>
      {nodeFunction(startValue, () => undefined)}
      <TouchableOpacity
        testID="swiper-next"
        onPress={() => {
          onUpdateCurrentIndex(1);
        }}
      >
        <Text>Next</Text>
      </TouchableOpacity>
    </View>
  );
});

const mockedUseTrainingsPlan = jest.mocked(useTrainingsPlan);
const mockedUseTrainingInTrainingsPlan = jest.mocked(useTrainingInTrainingsPlan);
const mockedDispatchChangeTrainingsName = jest.mocked(dispatchChangeTrainingsName);

describe('TrainingsPlanTab', () => {
  beforeEach(() => {
    mockedUseTrainingsPlan.mockReturnValue({
      id: 50,
      name: 'Power Plan',
      trainings: {'2,1': 100},
      trainingNames: {1: 'Upper Day'},
      mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
    });

    mockedUseTrainingInTrainingsPlan.mockReturnValue({
      id: 100,
      state: 'S',
      exercises: [],
      doneWorkoutIds: {},
      plannedWorkouts: {},
    });

    mockedDispatchChangeTrainingsName.mockClear();
    mockChangeTrainingsName.mockReset();
  });

  it('wires header props from current plan and training', () => {
    const navigation = {setOptions: jest.fn()};
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}};

    render(<TrainingsPlanTab navigation={navigation} route={route} />);

    const firstSetOptionsCall = navigation.setOptions.mock.calls[0][0];
    const header = firstSetOptionsCall.header;
    const {getByTestId} = render(header({}));

    expect(getByTestId('header-plan-name').props.children).toBe('Power Plan');
    expect(getByTestId('header-training-name').props.children).toBe('Upper Day');
    expect(getByTestId('header-mode').props.children).toBe('S');
    expect(getByTestId('header-micro').props.children).toBe('2');
  });

  it('opens and closes drawer from drawer callbacks', () => {
    const navigation = {setOptions: jest.fn()};
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}};

    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);

    expect(getByTestId('drawer-open-state').props.children).toBe('closed');

    fireEvent.press(getByTestId('drawer-open'));
    expect(getByTestId('drawer-open-state').props.children).toBe('open');

    fireEvent.press(getByTestId('drawer-close'));
    expect(getByTestId('drawer-open-state').props.children).toBe('closed');
  });

  it('updates micro from range swiper and drawer value changes', async () => {
    const navigation = {setOptions: jest.fn()};
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}};

    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);

    expect(getByTestId('node-micro').props.children).toBe('2');

    fireEvent.press(getByTestId('swiper-next'));

    await waitFor(() => {
      expect(getByTestId('node-micro').props.children).toBe('3');
    });

    fireEvent.press(getByTestId('drawer-micro-plus'));

    await waitFor(() => {
      expect(getByTestId('node-micro').props.children).toBe('4');
    });

    await act(async () => undefined);
  });
});
