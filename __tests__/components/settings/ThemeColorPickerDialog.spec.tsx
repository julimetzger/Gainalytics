import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import ThemeColorPickerDialog from '../../../app/components/settings/ThemeColorPickerDialog';

const renderDialog = (props: Partial<React.ComponentProps<typeof ThemeColorPickerDialog>> = {}) =>
  render(
    <PaperProvider>
      <ThemeColorPickerDialog
        visible
        initialColor="#0061A4"
        onDismiss={jest.fn()}
        onConfirm={jest.fn()}
        {...props}
      />
    </PaperProvider>,
  );

describe('ThemeColorPickerDialog', () => {
  it('opens on the currently applied colour', () => {
    const {getByTestId} = renderDialog({initialColor: '#E91E63'});
    expect(getByTestId('theme-color-preview-hex')).toHaveTextContent('#E91E63');
  });

  it('normalises a lower-case initial colour', () => {
    const {getByTestId} = renderDialog({initialColor: 'rgb(220, 184, 255)'});
    expect(getByTestId('theme-color-preview-hex')).toHaveTextContent('#DCB8FF');
  });

  it('updates the preview when a hex is typed', () => {
    const {getByTestId} = renderDialog();
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#00FF00');
    expect(getByTestId('theme-color-preview-hex')).toHaveTextContent('#00FF00');
  });

  it('ignores an incomplete hex while the user is still typing', () => {
    const {getByTestId} = renderDialog({initialColor: '#0061A4'});
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#00FF');
    expect(getByTestId('theme-color-preview-hex')).toHaveTextContent('#0061A4');
  });

  it('confirms with the currently selected colour', () => {
    const onConfirm = jest.fn();
    const {getByTestId} = renderDialog({onConfirm});
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#E91E63');
    fireEvent.press(getByTestId('theme-color-apply-button'));
    expect(onConfirm).toHaveBeenCalledWith('#E91E63');
  });

  it('does not confirm when cancelled', () => {
    const onConfirm = jest.fn();
    const onDismiss = jest.fn();
    const {getByTestId} = renderDialog({onConfirm, onDismiss});
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#E91E63');
    fireEvent.press(getByTestId('theme-color-cancel-button'));
    expect(onDismiss).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders the wheel and the brightness slider', () => {
    const {getByTestId} = renderDialog();
    expect(getByTestId('theme-color-wheel')).toBeTruthy();
    expect(getByTestId('theme-color-brightness-slider')).toBeTruthy();
  });

  it('shows the generated dependent colours in the preview', () => {
    const {getByText} = renderDialog();
    expect(getByText('Primary')).toBeTruthy();
    expect(getByText('Container')).toBeTruthy();
    expect(getByText('Surface')).toBeTruthy();
  });
});
