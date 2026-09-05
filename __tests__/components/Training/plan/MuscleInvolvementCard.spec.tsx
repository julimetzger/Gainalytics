import React from 'react';
import {render} from '@testing-library/react-native';
import MuscleInvolvementCard from '../../../../app/components/Training/plan/MuscleInvolvementCard';

// DropdownChip is captured so we can assert the value prop directly
const mockDropdownChip = jest.fn(() => null);
jest.mock('../../../../app/components/shared/DropdownChip', () => ({
  __esModule: true,
  default: (props: any) => mockDropdownChip(props),
}));

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('../../../../app/redux/Training/use/useTrainingsPlan', () => ({
  useTrainingsPlan: jest.fn(() => ({id: 1, trainingNames: {0: 'Push'}, trainings: {}})),
}));

jest.mock('../../../../app/redux/settings/dispatch/dispatchSetPlanMuscleMap', () => ({
  dispatchSetPlanMuscleMapMetric: () => jest.fn(),
  dispatchSetPlanMuscleMapCompare: () => jest.fn(),
  dispatchSetAnalyseMuscleMapCompare: () => jest.fn(),
}));

jest.mock('../../../../app/redux/Training/use/useMuscleInvolvement', () => ({
  useMuscleInvolvement: jest.fn(() => ({
    rows: [],
    globalMax: 0,
    effectiveCompare: 'none',
    referenceUnavailable: false,
  })),
  useLastMatchingTrainingMicro: jest.fn(),
  useThisTrainingPlannedAvailable: jest.fn(() => true),
}));

jest.mock('react-native-paper', () => {
  const {Text, TouchableOpacity, View} = require('react-native');
  return {
    useTheme: () => ({
      colors: {
        primary: '#000',
        tertiary: '#111',
        onSurfaceVariant: '#222',
        onSurface: '#333',
        surfaceVariant: '#444',
        elevation: {level1: '#444', level3: '#555'},
      },
    }),
    Text: ({children, ...p}: any) => <Text {...p}>{children}</Text>,
    IconButton: ({onPress, testID}: any) => <TouchableOpacity testID={testID} onPress={onPress} />,
    Menu: Object.assign(({children}: any) => <View>{children}</View>, {
      Item: ({onPress, title}: any) => <TouchableOpacity onPress={onPress}><Text>{title}</Text></TouchableOpacity>,
    }),
    Chip: ({children, onPress}: any) => <TouchableOpacity onPress={onPress}><Text>{children}</Text></TouchableOpacity>,
  };
});

const useSettings = require('../../../../app/redux/settings/use/useSettings').useSettings as jest.Mock;
const {useLastMatchingTrainingMicro, useMuscleInvolvement, useThisTrainingPlannedAvailable} = require('../../../../app/redux/Training/use/useMuscleInvolvement');

describe('MuscleInvolvementCard — effectiveSelectedCompare fallback (GH-300 P2)', () => {
  beforeEach(() => {
    mockDropdownChip.mockClear();
    useLastMatchingTrainingMicro.mockReset();
  });

  it('analyse view: when persisted selection is last_training_done but no done match exists, chip receives current_total_plan', () => {
    useSettings.mockReturnValue({
      muscleMapCompareSelectionAnalyse: 'last_training_done',
    });
    // No done match, but a plan match exists
    useLastMatchingTrainingMicro.mockImplementation((_planId: number, _tim: number, _micro: number, requireDone: boolean) =>
      requireDone ? undefined : 3,
    );

    render(
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />,
    );

    // Find the compare DropdownChip call (testID = muscle-map-compare-chip-analyse)
    const compareChipCall = mockDropdownChip.mock.calls.find((args) => args[0]?.testID === 'muscle-map-compare-chip-analyse');
    expect(compareChipCall).toBeDefined();
    const passedValue = compareChipCall![0].value;
    // Must NOT be 'last_training_done' since it was not added to options (no done match)
    expect(passedValue).not.toBe('last_training_done');
    // Must be a value that is always in options
    expect(passedValue).toBe('current_total_plan');
  });

  it('analyse view: when persisted selection is last_training_done AND a done match exists, chip keeps last_training_done', () => {
    useSettings.mockReturnValue({
      muscleMapCompareSelectionAnalyse: 'last_training_done',
    });
    // Done match exists
    useLastMatchingTrainingMicro.mockReturnValue(2);

    render(
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />,
    );

    const compareChipCall = mockDropdownChip.mock.calls.find((args) => args[0]?.testID === 'muscle-map-compare-chip-analyse');
    expect(compareChipCall).toBeDefined();
    expect(compareChipCall![0].value).toBe('last_training_done');
  });

  it('plan view: when persisted selection is last_training_done but no done match exists, chip falls back to current_total_plan', () => {
    useSettings.mockReturnValue({
      muscleMapCompareSelectionPlan: 'last_training_done',
    });
    useLastMatchingTrainingMicro.mockImplementation((_planId: number, _tim: number, _micro: number, requireDone: boolean) =>
      requireDone ? undefined : 3,
    );

    render(
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="plan" />,
    );

    const compareChipCall = mockDropdownChip.mock.calls.find((args) => args[0]?.testID === 'muscle-map-compare-chip');
    expect(compareChipCall).toBeDefined();
    expect(compareChipCall![0].value).toBe('current_total_plan');
  });
});

describe('MuscleInvolvementCard — analyse header label (GH-367 live training)', () => {
  beforeEach(() => {
    useSettings.mockReturnValue({});
    useLastMatchingTrainingMicro.mockReturnValue(undefined);
  });

  it('shows "THIS DONE TRAINING" for a finished training (isLive=false)', () => {
    const {getByText} = render(
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />,
    );

    expect(getByText('THIS DONE TRAINING')).toBeTruthy();
  });

  it('shows "THIS TRAINING (LIVE)" for a training still in progress (isLive=true)', () => {
    const {getByText, queryByText} = render(
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" isLive />,
    );

    expect(getByText('THIS TRAINING (LIVE)')).toBeTruthy();
    expect(queryByText('THIS DONE TRAINING')).toBeNull();
  });
});

// GH-436: the analysis compares against the micro's total plan without the user
// having to pick it; a persisted choice still wins.
describe('MuscleInvolvementCard — default compare (GH-436)', () => {
  beforeEach(() => {
    mockDropdownChip.mockClear();
    useLastMatchingTrainingMicro.mockReturnValue(2);
  });

  const compareChipValue = (testID: string) => {
    const call = mockDropdownChip.mock.calls.find((args: any[]) => args[0]?.testID === testID) as any[] | undefined;
    return call?.[0]?.value;
  };

  it('analyse view: falls back to current_total_plan when nothing is persisted, even if a done match exists', () => {
    useSettings.mockReturnValue({});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    expect(compareChipValue('muscle-map-compare-chip-analyse')).toBe('current_total_plan');
  });

  it('analyse view: a persisted selection survives and is not overridden by the default', () => {
    useSettings.mockReturnValue({muscleMapCompareSelectionAnalyse: 'none'});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    expect(compareChipValue('muscle-map-compare-chip-analyse')).toBe('none');
  });

  it('plan view: falls back to current_total_plan and names both the subject and the reference', () => {
    useSettings.mockReturnValue({});
    useMuscleInvolvement.mockReturnValueOnce({rows: [], globalMax: 0, effectiveCompare: 'current_total_plan', referenceUnavailable: false});

    const {getByText, getByTestId} = render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="plan" />);

    expect(compareChipValue('muscle-map-compare-chip')).toBe('current_total_plan');
    expect(getByText('THIS TRAINING (PLANNED)')).toBeTruthy();
    expect(getByTestId('muscle-map-compare-label').props.children).toBe('Current micro plan');
  });
});

// GH-444: the analysis of a training can be compared against the plan of that very
// training. The option is analysis-only (in the plan view the subject IS that plan)
// and dead when nothing was planned, instead of drawing a reference full of zeros.
describe('MuscleInvolvementCard — this training\'s plan (GH-444)', () => {
  beforeEach(() => {
    mockDropdownChip.mockClear();
    useLastMatchingTrainingMicro.mockReturnValue(2);
    useThisTrainingPlannedAvailable.mockReturnValue(true);
    useMuscleInvolvement.mockReturnValue({rows: [], globalMax: 0, effectiveCompare: 'none', referenceUnavailable: false});
  });

  const compareChipProps = (testID: string) => {
    const call = mockDropdownChip.mock.calls.find((args: any[]) => args[0]?.testID === testID) as any[] | undefined;
    return call?.[0];
  };

  const optionFor = (testID: string, value: string) =>
    compareChipProps(testID)?.options?.find((o: any) => o.value === value);

  it('offers the new reference in the analyse view', () => {
    useSettings.mockReturnValue({});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    const option = optionFor('muscle-map-compare-chip-analyse', 'this_training_plan');
    expect(option).toBeDefined();
    expect(option.label).toBe("This training's plan");
    expect(option.disabled).toBe(false);
  });

  it('keeps every previously available reference in the analyse view', () => {
    useSettings.mockReturnValue({});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    const values = compareChipProps('muscle-map-compare-chip-analyse').options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['none', 'current_total_plan', 'last_plan', 'last_training_plan', 'last_training_done']));
  });

  it('does not offer it in the plan view, where the subject already is that plan', () => {
    useSettings.mockReturnValue({});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="plan" />);

    expect(optionFor('muscle-map-compare-chip', 'this_training_plan')).toBeUndefined();
    const values = compareChipProps('muscle-map-compare-chip').options.map((o: any) => o.value);
    expect(values).toEqual(['none', 'current_total_plan', 'last_plan', 'last_training_plan', 'last_training_done']);
  });

  it('shows the option as disabled when nothing was planned for this training', () => {
    useSettings.mockReturnValue({});
    useThisTrainingPlannedAvailable.mockReturnValue(false);

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    const option = optionFor('muscle-map-compare-chip-analyse', 'this_training_plan');
    expect(option).toBeDefined();
    expect(option.disabled).toBe(true);
  });

  it('keeps a persisted this_training_plan selection when re-entering the screen', () => {
    useSettings.mockReturnValue({muscleMapCompareSelectionAnalyse: 'this_training_plan'});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    expect(compareChipProps('muscle-map-compare-chip-analyse').value).toBe('this_training_plan');
  });

  it('passes the new compare down to the involvement selector', () => {
    useSettings.mockReturnValue({muscleMapCompareSelectionAnalyse: 'this_training_plan'});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    expect(useMuscleInvolvement).toHaveBeenCalledWith(expect.objectContaining({compare: 'this_training_plan', view: 'analyse'}));
  });

  it('names the reference in the label when it is the active comparison', () => {
    useSettings.mockReturnValue({muscleMapCompareSelectionAnalyse: 'this_training_plan'});
    useMuscleInvolvement.mockReturnValue({rows: [], globalMax: 0, effectiveCompare: 'this_training_plan', referenceUnavailable: false});

    const {getByTestId} = render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    expect(getByTestId('muscle-map-compare-label').props.children).toBe("This training's plan");
  });

  it('falls back to a working reference when the persisted choice is not selectable here', () => {
    useSettings.mockReturnValue({muscleMapCompareSelectionAnalyse: 'this_training_plan'});
    useThisTrainingPlannedAvailable.mockReturnValue(false);

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" />);

    // never hand the chip a value it renders as a dead selection
    expect(compareChipProps('muscle-map-compare-chip-analyse').value).toBe('current_total_plan');
  });

  it('falls back in the plan view, where the option does not exist at all', () => {
    useSettings.mockReturnValue({muscleMapCompareSelectionPlan: 'this_training_plan'});

    render(<MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="plan" />);

    expect(compareChipProps('muscle-map-compare-chip').value).toBe('current_total_plan');
  });
});
