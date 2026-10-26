import React, {useRef} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {fireEvent, render, act} from '@testing-library/react-native';
import TrainingElementPicker, {Accumulation} from '../../../../app/components/picker/elements/TrainingElementPicker';
import {useAlleExercises} from '../../../../app/redux/Exercises/use/useAllExercises';
import {useAllTrainingsPlans} from '../../../../app/redux/Training/use/useAllTrainingsPlans';
import {Muscles} from '../../../../app/models/Muscles';
import {Metric} from '../../../../app/models/Metric';
import {AccumulationMode} from '../../../../app/models/AccumulationMode';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

const mockNextDropdownSelection: {value: string[]} = {value: []};

jest.mock('../../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: jest.fn(),
}));

jest.mock('../../../../app/redux/Training/use/useAllTrainingsPlans', () => ({
  useAllTrainingsPlans: jest.fn(),
}));

jest.mock('sharingan-rn-modal-dropdown', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return {
    MultiselectDropdown: ({
      label,
      value,
      onChange,
      autoOpen,
      selectionHeader,
      onBlur,
      hideChip,
      open,
    }: {
      label: string;
      value: string[];
      onChange: (value: string[]) => void;
      autoOpen?: boolean;
      selectionHeader?: boolean;
      onBlur?: () => void;
      hideChip?: boolean;
      open?: boolean;
    }) => (
      <View>
        <Text testID="dropdown-label">{label}</Text>
        <Text testID="dropdown-hide-chip">{String(hideChip)}</Text>
        <Text testID="dropdown-open">{String(open)}</Text>
        <Text testID="dropdown-value">{JSON.stringify(value)}</Text>
        <Text testID="dropdown-auto-open">{String(autoOpen)}</Text>
        <Text testID="dropdown-selection-header">{String(selectionHeader)}</Text>
        <TouchableOpacity
          testID="dropdown-change"
          onPress={() => {
            onChange(mockNextDropdownSelection.value);
          }}
        >
          <Text>Apply Dropdown Change</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="dropdown-blur" onPress={() => onBlur?.()}>
          <Text>Dismiss Dropdown</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');

  return {
    Icon: ({source}: {source: string}) => <Text>{source}</Text>,
    IconButton: ({onPress}: {onPress?: () => void}) => (
      <TouchableOpacity testID="toggle-picker" onPress={onPress}>
        <Text>Toggle Picker</Text>
      </TouchableOpacity>
    ),
    useTheme: () => ({
      colors: {
        primary: '#000000',
        primaryContainer: '#111111',
        onPrimaryContainer: '#ffffff',
      },
    }),
  };
});

const mockedUseAlleExercises = jest.mocked(useAlleExercises);
const mockedUseAllTrainingsPlans = jest.mocked(useAllTrainingsPlans);

describe('TrainingElementPicker', () => {
  const exercises: Exercise[] = [
    {id: 1, name: 'Squat'},
    {id: 2, name: 'Bench'},
  ];
  const trainingsPlan: TrainingsPlan[] = [
    {
      id: 11,
      name: 'Plan A',
      trainings: {'1,1': 101},
      trainingNames: {},
    },
  ];

  beforeEach(() => {
    mockedUseAlleExercises.mockReturnValue(exercises);
    mockedUseAllTrainingsPlans.mockReturnValue(trainingsPlan);
    mockNextDropdownSelection.value = [];
  });

  it('parses selected values into exercises, muscles, metrics, and accumulation', () => {
    const setExercise = jest.fn();
    const setMuscle = jest.fn();
    const setMetrics = jest.fn();
    const setAccumulation = jest.fn();

    mockNextDropdownSelection.value = ['1', Muscles.BACK, Metric.REPS, 'accumulationPlan A'];

    const {getByTestId} = render(
      <TrainingElementPicker
        exercise={[]}
        setExercise={setExercise}
        muscle={[]}
        setMuscle={setMuscle}
        setMetrics={setMetrics}
        setAccumulation={setAccumulation}
      />,
    );

    fireEvent.press(getByTestId('dropdown-change'));

    expect(setExercise).toHaveBeenCalledTimes(1);
    expect(setExercise).toHaveBeenCalledWith([{id: 1, name: 'Squat'}]);
    expect(setMuscle).toHaveBeenCalledWith([Muscles.BACK]);
    expect(setMetrics).toHaveBeenCalledWith([Metric.REPS]);
    expect(setAccumulation).toHaveBeenCalledWith(new Accumulation(AccumulationMode.TRAINING_MICROCYCLE, trainingsPlan[0]));
  });

  it('keeps every selected metric (GH-468: metrics are a multi-select filter)', () => {
    const setExercise = jest.fn();
    const setMetrics = jest.fn();

    mockNextDropdownSelection.value = [Metric.VOLUME, Metric.REPS];

    const {getByTestId} = render(<TrainingElementPicker exercise={[]} setExercise={setExercise} metrics={[Metric.VOLUME]} setMetrics={setMetrics} />);

    fireEvent.press(getByTestId('dropdown-change'));

    expect(setMetrics).toHaveBeenCalledTimes(1);
    expect(setMetrics).toHaveBeenCalledWith([Metric.VOLUME, Metric.REPS]);
  });

  it('keeps only one accumulation when multiple accumulations are selected', () => {
    const setExercise = jest.fn();
    const setAccumulation = jest.fn();
    const currentAccumulation = new Accumulation(AccumulationMode.SINGLE_DAY);

    mockNextDropdownSelection.value = [currentAccumulation.getId(), new Accumulation(AccumulationMode.WEEK).getId()];

    const {getByTestId} = render(
      <TrainingElementPicker
        exercise={[]}
        setExercise={setExercise}
        setAccumulation={setAccumulation}
        accumulation={currentAccumulation}
      />,
    );

    fireEvent.press(getByTestId('dropdown-change'));

    expect(setAccumulation).toHaveBeenCalledTimes(1);
    expect(setAccumulation).toHaveBeenCalledWith(new Accumulation(AccumulationMode.WEEK));
  });

  it('supports internal visibility toggle and external onToggle callback', () => {
    const setExercise = jest.fn();
    const onToggle = jest.fn();

    const {getByTestId, queryByTestId, rerender} = render(<TrainingElementPicker exercise={[]} setExercise={setExercise} visible={false} />);

    // MultiselectDropdown is always mounted but hidden via display:none when not visible.
    // RNTL excludes display:none elements from default queries, so this returns null.
    expect(queryByTestId('dropdown-label')).toBeNull();

    fireEvent.press(getByTestId('toggle-picker'));
    expect(getByTestId('dropdown-label').props.children).toBe('Select Exercises, Metrics, Accumulation Mode');

    rerender(<TrainingElementPicker exercise={[]} setExercise={setExercise} visible={false} onToggle={onToggle} />);

    fireEvent.press(getByTestId('toggle-picker'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // GH-617: Records starts collapsed but keeps the "N selected" anchor row.
  it('collapseToSummary keeps the anchor (summary) visible and only hides the chips while collapsed', () => {
    const setExercise = jest.fn();
    const {getByTestId} = render(<TrainingElementPicker exercise={[]} setExercise={setExercise} visible={false} collapseToSummary />);

    expect(getByTestId('dropdown-label').props.children).toBe('Select Exercises, Metrics, Accumulation Mode');
    expect(getByTestId('dropdown-hide-chip').props.children).toBe('true');
    // The anchor stays tappable: the modal must not be force-closed.
    expect(getByTestId('dropdown-open').props.children).toBe('true');

    fireEvent.press(getByTestId('toggle-picker'));
    expect(getByTestId('dropdown-hide-chip').props.children).toBe('false');

    fireEvent.press(getByTestId('toggle-picker'));
    expect(getByTestId('dropdown-hide-chip').props.children).toBe('true');
  });

  // GH-403 (UX audit M7): with openListOnShow the "+" tile must land the user
  // straight in the list — no second tap on the anchor row.
  describe('openListOnShow', () => {
    it('asks the dropdown to open itself as soon as the picker becomes visible', () => {
      const setExercise = jest.fn();

      const {getByTestId, rerender} = render(
        <TrainingElementPicker exercise={[]} setExercise={setExercise} visible={false} openListOnShow />,
      );

      // The dropdown stays mounted behind display:none while hidden, so this
      // query has to look past RNTL's default visibility filter.
      expect(getByTestId('dropdown-auto-open', {includeHiddenElements: true}).props.children).toBe('false');

      rerender(<TrainingElementPicker exercise={[]} setExercise={setExercise} visible openListOnShow />);

      expect(getByTestId('dropdown-auto-open').props.children).toBe('true');
      expect(getByTestId('dropdown-selection-header').props.children).toBe('true');
    });

    it('retracts the picker when the list is dismissed, so no anchor row is left behind', () => {
      const setExercise = jest.fn();
      const onToggle = jest.fn();

      const {getByTestId} = render(
        <TrainingElementPicker exercise={[]} setExercise={setExercise} visible onToggle={onToggle} openListOnShow />,
      );

      fireEvent.press(getByTestId('dropdown-blur'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('leaves every other call site on the untouched tap-to-open anchor', () => {
      const setExercise = jest.fn();

      const {getByTestId} = render(<TrainingElementPicker exercise={[]} setExercise={setExercise} visible />);

      expect(getByTestId('dropdown-auto-open').props.children).toBe('undefined');
      expect(getByTestId('dropdown-selection-header').props.children).toBe('undefined');

      // A dismissed list must not toggle anything away either.
      fireEvent.press(getByTestId('dropdown-blur'));
      expect(getByTestId('dropdown-label')).toBeTruthy();
    });
  });

  // Regression test for GH-127: infinite render loop caused by non-memoized selectors
  // and .find() in useEffect dep array. Simulates the pattern that triggered the crash:
  // the parent re-renders with a new exercises/plans array reference on each tick
  // (as if the Redux selector was not memoized), and the library's internal onChange
  // calls back into the component. Render count must stay bounded.
  it('does not enter an infinite render loop when hooks return new array references on each call', () => {
    let renderCount = 0;

    // Track how many times MultiselectDropdown receives a new `data` prop reference
    let dataRefChangeCount = 0;
    let lastDataRef: unknown = undefined;

    // Override the mock to count data reference changes (simulates library's useEffect)
    const {MultiselectDropdown: OriginalMock} = jest.requireMock('sharingan-rn-modal-dropdown');
    const spyMock = jest.fn(({data, ...rest}: {data: unknown; label: string; value: string[]; onChange: (v: string[]) => void}) => {
      if (data !== lastDataRef) {
        dataRefChangeCount++;
        lastDataRef = data;
      }
      renderCount++;
      return OriginalMock({data, ...rest});
    });

    // Temporarily override the mock with the spy
    const mockModule = jest.requireMock('sharingan-rn-modal-dropdown');
    const originalImpl = mockModule.MultiselectDropdown;
    mockModule.MultiselectDropdown = spyMock;

    try {
      const setExercise = jest.fn();

      // Simulate the hooks returning new array references on every call (pre-fix behaviour)
      // By always returning a new [] the component sees unstable deps every render
      mockedUseAlleExercises.mockImplementation(() => [...exercises]);
      mockedUseAllTrainingsPlans.mockImplementation(() => [...trainingsPlan]);

      const {rerender} = render(<TrainingElementPicker exercise={[]} setExercise={setExercise} />);

      // Simulate several parent re-renders (as if unrelated store ticks happened)
      act(() => {
        rerender(<TrainingElementPicker exercise={[]} setExercise={setExercise} />);
        rerender(<TrainingElementPicker exercise={[]} setExercise={setExercise} />);
        rerender(<TrainingElementPicker exercise={[]} setExercise={setExercise} />);
      });

      // Even though the hooks return new array refs each call, the component's internal
      // useMemo should stabilize dropdownExerciseStructure so the library sees stable data.
      // Data reference changes must be bounded — if they grow with each rerender, the loop
      // is back. Allow at most 2 (initial + one recompute at most).
      expect(dataRefChangeCount).toBeLessThanOrEqual(2);
      // setExercise must not be called spuriously by the render loop
      expect(setExercise).not.toHaveBeenCalled();
    } finally {
      mockModule.MultiselectDropdown = originalImpl;
    }
  });
});
