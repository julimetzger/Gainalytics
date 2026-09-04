import React from 'react';
import {render} from '@testing-library/react-native';
import MicroMuscleMapCard, {microPlanCompareLabel} from '../../../../app/components/Training/analyse/MicroMuscleMapCard';

const mockDropdownChip = jest.fn();
const mockUseMicroPlannedMuscleInvolvement = jest.fn();

jest.mock('../../../../app/components/shared/DropdownChip', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDropdownChip(props);
    return null;
  },
}));

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: () => ({}),
}));

jest.mock('../../../../app/redux/settings/dispatch/dispatchSetPlanMuscleMap', () => ({
  dispatchSetPlanMuscleMapMetric: () => jest.fn(),
}));

jest.mock('../../../../app/redux/Training/use/useMuscleInvolvement', () => ({
  useMicroPlannedMuscleInvolvement: (...args: unknown[]) => mockUseMicroPlannedMuscleInvolvement(...args),
}));

jest.mock('../../../../app/components/analyse/MuscleMapBarList', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return ({showReferenceLayer}: any) => <Text testID="bar-list-mock">{String(showReferenceLayer)}</Text>;
});

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {
    useTheme: () => ({colors: {onSurfaceVariant: '#222', surfaceVariant: '#444', elevation: {level1: '#444'}}}),
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
  };
});

const compareChipProps = () => mockDropdownChip.mock.calls.map((call) => call[0]).find((props) => props.testID === 'micro-muscle-map-compare-chip');

describe('MicroMuscleMapCard (GH-436 Overview Plan position)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMicroPlannedMuscleInvolvement.mockReturnValue({rows: [{muscleGroupId: 'BACK', label: 'Back', today: 12, reference: 10}], globalMax: 12, referenceUnavailable: false, effectiveCompare: 'last_training_done'});
  });

  it('compares the planned micro against what was trained in it by default', () => {
    const {getByText, getByTestId} = render(<MicroMuscleMapCard trainingsPlanId={5} micro={2} />);

    expect(mockUseMicroPlannedMuscleInvolvement).toHaveBeenCalledWith(5, 2, 'sets', 'done');
    expect(getByText('THIS MICRO (PLANNED)')).toBeTruthy();
    expect(getByTestId('micro-muscle-map-compare-label').props.children).toBe('THIS MICRO (DONE)');
    expect(getByTestId('bar-list-mock').props.children).toBe('true');
    expect(compareChipProps()?.value).toBe('done');
  });

  it('keeps the previous micro plan selectable and disables it for the first micro', () => {
    render(<MicroMuscleMapCard trainingsPlanId={5} micro={1} />);

    const options = compareChipProps()?.options as {value: string; label: string; disabled?: boolean}[];
    expect(options.map((option) => option.value)).toEqual(['done', 'last_plan', 'none']);
    expect(options.find((option) => option.value === 'last_plan')?.disabled).toBe(true);
    expect(options.find((option) => option.value === 'last_plan')?.label).toBe('No previous plan');
  });

  it('names the missing reference instead of pretending to compare', () => {
    mockUseMicroPlannedMuscleInvolvement.mockReturnValue({rows: [{muscleGroupId: 'BACK', label: 'Back', today: 12, reference: 0}], globalMax: 12, referenceUnavailable: true, effectiveCompare: 'none'});

    const {getByTestId} = render(<MicroMuscleMapCard trainingsPlanId={5} micro={2} />);

    expect(getByTestId('micro-muscle-map-compare-label').props.children).toBe('NOTHING TRAINED YET');
    expect(getByTestId('bar-list-mock').props.children).toBe('false');
  });

  it('shows the empty hint instead of a blank card when nothing is planned', () => {
    mockUseMicroPlannedMuscleInvolvement.mockReturnValue({rows: [], globalMax: 0, referenceUnavailable: true, effectiveCompare: 'none'});

    const {getByTestId, queryByTestId} = render(<MicroMuscleMapCard trainingsPlanId={5} micro={2} />);

    expect(getByTestId('micro-muscle-map-empty')).toBeTruthy();
    expect(queryByTestId('bar-list-mock')).toBeNull();
  });
});

describe('microPlanCompareLabel', () => {
  it('names each reference', () => {
    expect(microPlanCompareLabel('done', 3, false)).toBe('THIS MICRO (DONE)');
    expect(microPlanCompareLabel('done', 3, true)).toBe('NOTHING TRAINED YET');
    expect(microPlanCompareLabel('last_plan', 3, false)).toBe('MICRO 2 PLAN');
    expect(microPlanCompareLabel('last_plan', 1, true)).toBe('NO PREVIOUS PLAN');
    expect(microPlanCompareLabel('none', 3, false)).toBe('NONE');
  });
});
