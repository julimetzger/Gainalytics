import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import AnalyseEmptyState from '../../../app/components/analyse/AnalyseEmptyState';

/**
 * GH-458 (H3/M4): every Analyse empty state must name the CAUSE and offer at
 * least one action. The audit's benchmark was Training Length, which does both.
 */
describe('AnalyseEmptyState (GH-458 H3)', () => {
  const renderEmptyState = (props: Partial<React.ComponentProps<typeof AnalyseEmptyState>> = {}) =>
    render(
      <PaperProvider>
        <AnalyseEmptyState
          testID="analyse-chart-empty-state"
          title="No sets for Squat in this range"
          description="Squat has no logged sets between 14/06/26 and 20/09/26."
          actions={[{label: 'Extend to last 12 months', testID: 'extend-range', onPress: jest.fn()}]}
          {...props}
        />
      </PaperProvider>,
    );

  it('renders the cause as title and description', () => {
    const {getByText, getByTestId} = renderEmptyState();

    expect(getByText('No sets for Squat in this range')).toBeTruthy();
    expect(getByTestId('analyse-chart-empty-state-description').props.children).toBe('Squat has no logged sets between 14/06/26 and 20/09/26.');
  });

  it('renders every action and calls back on press', () => {
    const onPress = jest.fn();
    const {getByTestId} = renderEmptyState({
      actions: [
        {label: 'Extend to last 12 months', testID: 'extend-range', onPress},
        {label: 'Jump to last training', testID: 'jump-to-last', onPress: jest.fn()},
      ],
    });

    expect(getByTestId('jump-to-last')).toBeTruthy();
    fireEvent.press(getByTestId('extend-range'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without actions when a screen has none to offer', () => {
    const {getByTestId, queryByTestId} = renderEmptyState({actions: []});

    expect(getByTestId('analyse-chart-empty-state')).toBeTruthy();
    expect(queryByTestId('extend-range')).toBeNull();
  });
});
