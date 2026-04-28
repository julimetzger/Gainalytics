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
});
