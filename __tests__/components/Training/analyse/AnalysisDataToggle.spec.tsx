import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import AnalysisDataToggle, {AnalysisDataMode} from '../../../../app/components/Training/analyse/AnalysisDataToggle';
import AnalysisTotalSets, {formatTotalSets} from '../../../../app/components/Training/analyse/AnalysisTotalSets';

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {
    Text,
    useTheme: () => ({
      colors: {primary: '#6200ee', onSurfaceVariant: '#888', secondaryContainer: '#e8def8'},
    }),
  };
});

describe('AnalysisDataToggle (GH-417)', () => {
  it('renders both positions', () => {
    const {getByTestId, getByText} = render(<AnalysisDataToggle value="train" onChange={jest.fn()} />);

    expect(getByTestId('analysis-data-plan')).toBeTruthy();
    expect(getByTestId('analysis-data-train')).toBeTruthy();
    expect(getByText('Plan')).toBeTruthy();
    expect(getByText('Train')).toBeTruthy();
  });

  it('marks the current position as selected — Train is the start position', () => {
    const {getByTestId} = render(<AnalysisDataToggle value="train" onChange={jest.fn()} />);

    expect(getByTestId('analysis-data-train').props.accessibilityState).toEqual({selected: true});
    expect(getByTestId('analysis-data-plan').props.accessibilityState).toEqual({selected: false});
  });

  it('moves the selection marker with the value', () => {
    const {getByTestId} = render(<AnalysisDataToggle value="plan" onChange={jest.fn()} />);

    expect(getByTestId('analysis-data-plan').props.accessibilityState).toEqual({selected: true});
    expect(getByTestId('analysis-data-train').props.accessibilityState).toEqual({selected: false});
  });

  it('reports the pressed position to its owner', () => {
    const onChange = jest.fn<void, [AnalysisDataMode]>();
    const {getByTestId} = render(<AnalysisDataToggle value="train" onChange={onChange} />);

    fireEvent.press(getByTestId('analysis-data-plan'));
    expect(onChange).toHaveBeenCalledWith('plan');

    fireEvent.press(getByTestId('analysis-data-train'));
    expect(onChange).toHaveBeenLastCalledWith('train');
  });
});

describe('AnalysisTotalSets (GH-417 AC4)', () => {
  it('names the scope so the number cannot be read against the wrong data', () => {
    expect(formatTotalSets(24, 'planned')).toBe('Total Sets: 24 (planned)');
    expect(formatTotalSets(0, 'done')).toBe('Total Sets: 0 (done)');
  });

  it('renders the total under a stable testID', () => {
    const {getByTestId} = render(<AnalysisTotalSets totalSets={17} scope="done" />);

    expect(getByTestId('analysis-total-sets').props.children).toBe('Total Sets: 17 (done)');
  });
});
