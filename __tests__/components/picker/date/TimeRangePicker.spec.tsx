/**
 * GH-522: the timer rows in Settings keep their delete button right-aligned —
 * a long title gives way instead of pushing the button out of the row.
 */
import React from 'react';
import {StyleSheet} from 'react-native';
import {Button, MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
import {fireEvent, render, screen} from '@testing-library/react-native';
import TimeRangePicker from '../../../../app/components/picker/date/TimeRangePicker';

jest.mock('react-native-timer-picker', () => ({
  TimerPickerModal: () => null,
}));

const renderPicker = (setPauseTimer = jest.fn()) =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <TimeRangePicker title="Finish Training Timer: " setPauseTimer={setPauseTimer} timeRange={1200} testID="finish-timer" />
    </PaperProvider>,
  );

describe('TimeRangePicker', () => {
  it('shows the title with the formatted time', () => {
    renderPicker();

    expect(screen.getByText('Finish Training Timer: 0h 20m 0s')).toBeTruthy();
  });

  it('lets the time button shrink so the delete button stays at the right end of the row', () => {
    renderPicker();

    expect(StyleSheet.flatten(screen.getByTestId('finish-timer-row').props.style)).toMatchObject({
      flexDirection: 'row',
      justifyContent: 'space-between',
    });
    // Paper moves flexShrink to the Surface's outer layer, so check what the row hands the button.
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(Button).props.style)).toMatchObject({flexShrink: 1});
  });

  it('resets the timer with the delete button', () => {
    const setPauseTimer = jest.fn();
    renderPicker(setPauseTimer);

    fireEvent.press(screen.getByTestId('finish-timer-delete'));

    expect(setPauseTimer).toHaveBeenCalledWith(undefined);
  });
});
