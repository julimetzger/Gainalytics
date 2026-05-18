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
  dispatchSetPlanMuscleMapEnabled: () => jest.fn(),
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
const {useLastMatchingTrainingMicro} = require('../../../../app/redux/Training/use/useMuscleInvolvement');

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
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" showDismiss={false} />,
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
      <MuscleInvolvementCard trainingsPlanId={1} micro={4} trainingInMicro={0} view="analyse" showDismiss={false} />,
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
