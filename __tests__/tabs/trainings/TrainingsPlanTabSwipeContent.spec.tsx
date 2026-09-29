import React, {useRef} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import TrainingsPlanTab from '../../../app/tabs/trainings/TrainingsPlanTab';
import {useTrainingsPlan} from '../../../app/redux/Training/use/useTrainingsPlan';
import {useTrainingInTrainingsPlan} from '../../../app/redux/Training/use/useTrainingInTrainingsPlan';
import {TrainingsState} from '../../../app/models/TrainingsState';

// PERF-003: only the pane the user is on renders its content; the neighbours render a placeholder.
// After a swipe the pane the user came from keeps its content while it slides out, the arriving pane
// gets its content once the snap animation is over.

jest.mock('../../../app/redux/Training/use/useTrainingsPlan', () => ({useTrainingsPlan: jest.fn()}));
jest.mock('../../../app/redux/Training/use/useTrainingInTrainingsPlan', () => ({useTrainingInTrainingsPlan: jest.fn()}));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchChangeTrainingsName', () => jest.fn(() => jest.fn()));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchAddMeso', () => jest.fn(() => jest.fn()));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchEditMeso', () => jest.fn(() => jest.fn()));
jest.mock('../../../app/redux/Training/dispatch/general/dispatchDeleteMeso', () => jest.fn(() => jest.fn()));

jest.mock('react-native-paper', () => ({
  Button: () => null,
  IconButton: () => null,
  useTheme: () => ({colors: {background: '#fff', onSecondaryContainer: '#000'}}),
}));

jest.mock('react-native-drawer-layout', () => {
  const {View} = require('react-native');
  return {Drawer: ({renderDrawerContent, children}: any) => (
    <View>
      {renderDrawerContent()}
      {children}
    </View>
  )};
});

jest.mock('../../../app/components/Training/TrainingsPlanHeader', () => () => null);
jest.mock('../../../app/components/Training/TrainingsPlanDrawer', () => {
  const {Text, TouchableOpacity} = require('react-native');
  return ({handleValueChange}: any) => (
    <TouchableOpacity testID="drawer-micro-plus" onPress={() => handleValueChange('micro + 1')}>
      <Text>Micro Plus</Text>
    </TouchableOpacity>
  );
});

jest.mock('../../../app/components/Training/TrainingsPlanNode', () => {
  const {Text} = require('react-native');
  return ({micro, renderContent}: any) => <Text testID={`node-${micro}`}>{renderContent ? 'content' : 'placeholder'}</Text>;
});

// Three panes around the value the swiper was mounted with (like the real one), the active one being
// the pane whose value equals `startValue` (the screen's current micro).
jest.mock('../../../app/components/RangeSwiper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const actual = jest.requireActual('../../../app/components/RangeSwiper');
  const Swiper = ({startValue, nodeFunction, onUpdateCurrentIndex}: any) => {
    const mounted = React.useRef(startValue).current;
    return (
      <View>
        {[mounted - 1, mounted, mounted + 1].map((value: number) => (
          <View key={value}>{nodeFunction(value, () => undefined, value === startValue)}</View>
        ))}
        <TouchableOpacity testID="swiper-next" onPress={() => onUpdateCurrentIndex(1)}>
          <Text>Next</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="swiper-prev" onPress={() => onUpdateCurrentIndex(-1)}>
          <Text>Prev</Text>
        </TouchableOpacity>
      </View>
    );
  };
  return {__esModule: true, default: Swiper, SWIPE_SETTLE_MS: actual.SWIPE_SETTLE_MS};
});

const navigation = {setOptions: jest.fn(), addListener: jest.fn(() => jest.fn())} as any;
const route = {params: {trainingsPlan: {id: 50, name: 'Power Plan'}, micro: 2, training: 1}} as any;
const {SWIPE_SETTLE_MS} = jest.requireActual('../../../app/components/RangeSwiper');

const content = (getByTestId: any, micro: number) => getByTestId(`node-${micro}`).props.children;

describe('TrainingsPlanTab — content only in the pane the user is on (PERF-003)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(useTrainingsPlan).mockReturnValue({
      id: 50,
      name: 'Power Plan',
      trainings: {},
      trainingNames: {1: 'Upper Day'},
      mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
    } as any);
    jest.mocked(useTrainingInTrainingsPlan).mockReturnValue({id: 100, state: TrainingsState.STARTED, exercises: [], doneWorkoutIds: {}, plannedWorkouts: {}} as any);
  });
  afterEach(() => jest.useRealTimers());

  it('renders the content of the active pane and a placeholder in both neighbours', () => {
    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);
    expect(content(getByTestId, 2)).toBe('content');
    expect(content(getByTestId, 1)).toBe('placeholder');
    expect(content(getByTestId, 3)).toBe('placeholder');
  });

  it('keeps the departing pane\'s content while the swipe animation runs and afterwards; the arriving pane gets its content after the snap', () => {
    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('swiper-next'));
    // sliding: the pane the user came from still shows its content, the arriving one shows its title only
    expect(content(getByTestId, 2)).toBe('content');
    expect(content(getByTestId, 3)).toBe('placeholder');
    act(() => {
      jest.advanceTimersByTime(SWIPE_SETTLE_MS - 1);
    });
    expect(content(getByTestId, 3)).toBe('placeholder');
    act(() => {
      jest.advanceTimersByTime(1);
    });
    // snapped in: the arriving pane has its content, the pane the user left keeps its own (swiping back is instant)
    expect(content(getByTestId, 3)).toBe('content');
    expect(content(getByTestId, 2)).toBe('content');
    expect(content(getByTestId, 1)).toBe('placeholder');
  });

  it('swiping back finds the content of the pane it returns to already in place — no placeholder, no wait', () => {
    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('swiper-next'));
    act(() => {
      jest.advanceTimersByTime(SWIPE_SETTLE_MS);
    });
    fireEvent.press(getByTestId('swiper-prev'));
    expect(content(getByTestId, 2)).toBe('content');
    expect(content(getByTestId, 3)).toBe('content');
  });

  it('drops the content of a pane once the user has moved two micros away from it', () => {
    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('swiper-next'));
    act(() => {
      jest.advanceTimersByTime(SWIPE_SETTLE_MS);
    });
    fireEvent.press(getByTestId('swiper-next'));
    // micro 4 is coming; 3 (the one just left) keeps its content, 2 has lost it
    expect(content(getByTestId, 3)).toBe('content');
    expect(content(getByTestId, 2)).toBe('placeholder');
  });

  it('drawer navigation shows the target content at once, without waiting for a swipe transition', () => {
    const {getByTestId} = render(<TrainingsPlanTab navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('swiper-next'));
    fireEvent.press(getByTestId('drawer-micro-plus'));
    // micro 2 -> 3 (swipe) -> 4 (drawer): the swiper is rebuilt around 4, whose pane is active immediately
    expect(content(getByTestId, 4)).toBe('content');
    expect(content(getByTestId, 3)).toBe('placeholder');
    expect(content(getByTestId, 5)).toBe('placeholder');
  });
});
