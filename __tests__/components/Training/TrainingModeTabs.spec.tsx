import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import TrainingModeTabs, {SubTab} from '../../../app/components/Training/TrainingModeTabs';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return {
    Text: ({children, style}: any) => <Text style={style}>{children}</Text>,
    useTheme: () => ({
      colors: {primary: '#6200ee', onSurfaceVariant: '#888'},
    }),
  };
});

describe('TrainingModeTabs', () => {
  it('renders all three tabs with correct testIDs', () => {
    const {getByTestId} = render(<TrainingModeTabs activeTab="train" onTabChange={jest.fn()} />);
    expect(getByTestId('subtab-train')).toBeTruthy();
    expect(getByTestId('subtab-plan')).toBeTruthy();
    expect(getByTestId('subtab-analysis')).toBeTruthy();
  });

  it('calls onTabChange with correct tab id when pressed', () => {
    const onTabChange = jest.fn();
    const {getByTestId} = render(<TrainingModeTabs activeTab="train" onTabChange={onTabChange} />);
    fireEvent.press(getByTestId('subtab-plan'));
    expect(onTabChange).toHaveBeenCalledWith('plan');
    fireEvent.press(getByTestId('subtab-analysis'));
    expect(onTabChange).toHaveBeenCalledWith('analysis');
  });

  it('shows Train, Plan, Analysis labels', () => {
    const {getByText} = render(<TrainingModeTabs activeTab="train" onTabChange={jest.fn()} />);
    expect(getByText('Train')).toBeTruthy();
    expect(getByText('Plan')).toBeTruthy();
    expect(getByText('Analysis')).toBeTruthy();
  });

  it('renders tabs left-to-right in the order Plan, Train, Analysis', () => {
    const {root, getAllByText} = render(
      <TrainingModeTabs activeTab="train" onTabChange={jest.fn()} />,
    );

    // The container is flexDirection: 'row', so tree order == left-to-right order.
    expect(getAllByText(/^(Plan|Train|Analysis)$/).map((label) => label.props.children)).toEqual([
      'Plan',
      'Train',
      'Analysis',
    ]);

    // Same order at the testID level. Dedupe: a testID appears on both the
    // composite and the host node, and Set preserves insertion order.
    const testIDs = root.findAll((node) => typeof node.props?.testID === 'string');
    expect([...new Set(testIDs.map((tab) => tab.props.testID))]).toEqual([
      'subtab-plan',
      'subtab-train',
      'subtab-analysis',
    ]);
  });
});
