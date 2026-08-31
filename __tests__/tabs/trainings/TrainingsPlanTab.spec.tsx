import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import TrainingsPlanTab from '../../../app/tabs/trainings/TrainingsPlanTab';
import {useTrainingsPlan} from '../../../app/redux/Training/use/useTrainingsPlan';
import {useTrainingInTrainingsPlan} from '../../../app/redux/Training/use/useTrainingInTrainingsPlan';
import dispatchChangeTrainingsName from '../../../app/redux/Training/dispatch/general/dispatchChangeTrainingsName';
import {TrainingsState} from '../../../app/models/TrainingsState';

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
    Button: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
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

  return ({trainingsPlanName, trainingName, trainingState, micro, localMicro, drawerMenu, overflowButton}: {trainingsPlanName: string; trainingName: string; trainingState?: string; micro?: number; localMicro?: number; drawerMenu: React.ReactNode; overflowButton: React.ReactNode}) => (
    <View>
      <Text testID="header-plan-name">{trainingsPlanName}</Text>
      <Text testID="header-training-name">{trainingName}</Text>
      <Text testID="header-training-state">{trainingState}</Text>
      <Text testID="header-micro">{micro !== undefined ? String(micro) : ''}</Text>
      {drawerMenu}
      {overflowButton}
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
  const {Text, TouchableOpacity, View} = require('react-native');

  // Surfaces the GH-417 analysis-data wiring so a test can flip the toggle and
  // check that the screen — not the swiper pane — owns the choice.
  return ({micro, analysisDataMode, onAnalysisDataModeChange}: any) => (
    <View>
      <Text testID="node-micro">{String(micro)}</Text>
      <Text testID="node-analysis-data-mode">{String(analysisDataMode)}</Text>
      <TouchableOpacity testID="node-select-plan" onPress={() => onAnalysisDataModeChange('plan')}>
        <Text>plan</Text>
      </TouchableOpacity>
    </View>
  );
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
      state: TrainingsState.STARTED,
      exercises: [],
      doneWorkoutIds: {},
      plannedWorkouts: {},
    });

    mockedDispatchChangeTrainingsName.mockClear();
    mockChangeTrainingsName.mockReset();
  });

  it('wires header props from current plan and training', () => {
    const navigation = {setOptions: jest.fn(), addListener: jest.fn(() => jest.fn())} as any;
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}} as any;

    render(<TrainingsPlanTab navigation={navigation} route={route} />);

    const firstSetOptionsCall = navigation.setOptions.mock.calls[0][0];
    const header = firstSetOptionsCall.header;
    const {getByTestId} = render(header({}));

    expect(getByTestId('header-plan-name').props.children).toBe('Power Plan');
    expect(getByTestId('header-training-name').props.children).toBe('Upper Day');
    expect(getByTestId('header-training-state').props.children).toBe(TrainingsState.STARTED);
    expect(getByTestId('header-micro').props.children).toBe('2');
  });

  it('opens and closes drawer from drawer callbacks', () => {
    const navigation = {setOptions: jest.fn(), addListener: jest.fn(() => jest.fn())} as any;
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}} as any;

    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);

    expect(getByTestId('drawer-open-state').props.children).toBe('closed');

    fireEvent.press(getByTestId('drawer-open'));
    expect(getByTestId('drawer-open-state').props.children).toBe('open');

    fireEvent.press(getByTestId('drawer-close'));
    expect(getByTestId('drawer-open-state').props.children).toBe('closed');
  });

  it('updates micro from range swiper and drawer value changes', async () => {
    const navigation = {setOptions: jest.fn(), addListener: jest.fn(() => jest.fn())} as any;
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}} as any;

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

  it('keeps swipe navigation inside the locked meso', async () => {
    mockedUseTrainingsPlan.mockReturnValue({
      id: 50,
      name: 'Power Plan',
      trainings: {'1,1': 100, '2,1': 101},
      trainingNames: {1: 'Upper Day'},
      mesos: [
        {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
        {id: 2, name: 'Meso 2', order: 2, startMicro: 2},
      ],
    });

    const navigation = {setOptions: jest.fn(), addListener: jest.fn(() => jest.fn())} as any;
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 1, training: 1}} as any;

    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);

    expect(getByTestId('node-micro').props.children).toBe('1');

    fireEvent.press(getByTestId('swiper-next'));

    await waitFor(() => {
      expect(getByTestId('node-micro').props.children).toBe('1');
    });
  });

  // GH-417 AC7: swiping to another micro remounts the swiper panes, so the
  // Plan | Train choice has to live on the screen to survive it.
  it('keeps the analysis data choice across a micro change', async () => {
    const navigation = {setOptions: jest.fn(), addListener: jest.fn(() => jest.fn())} as any;
    const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}} as any;

    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);

    expect(getByTestId('node-analysis-data-mode').props.children).toBe('train');

    fireEvent.press(getByTestId('node-select-plan'));
    await waitFor(() => {
      expect(getByTestId('node-analysis-data-mode').props.children).toBe('plan');
    });

    fireEvent.press(getByTestId('swiper-next'));
    await waitFor(() => {
      expect(getByTestId('node-micro').props.children).toBe('3');
    });
    expect(getByTestId('node-analysis-data-mode').props.children).toBe('plan');

    fireEvent.press(getByTestId('drawer-micro-plus'));
    await waitFor(() => {
      expect(getByTestId('node-micro').props.children).toBe('4');
    });
    expect(getByTestId('node-analysis-data-mode').props.children).toBe('plan');

    await act(async () => undefined);
  });
});
