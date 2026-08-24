import React from 'react';
import {Dimensions, StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import ThemeColorPickerDialog from '../../../app/components/settings/ThemeColorPickerDialog';

/** Pretend the window is a landscape phone for the duration of one test. */
const withWindow = (width: number, height: number) => jest.spyOn(Dimensions, 'get').mockReturnValue({width, height, scale: 3, fontScale: 1} as ReturnType<typeof Dimensions.get>);

const renderDialog = (props: Partial<React.ComponentProps<typeof ThemeColorPickerDialog>> = {}) =>
  render(
    <PaperProvider>
      <ThemeColorPickerDialog visible initialColor="#0061A4" onDismiss={jest.fn()} onConfirm={jest.fn()} {...props} />
    </PaperProvider>,
  );

describe('ThemeColorPickerDialog', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('blocks Apply while the hex field holds an unparseable value', () => {
    const onConfirm = jest.fn();
    const {getByTestId} = renderDialog({initialColor: '#0061A4', onConfirm});
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#00FF');

    // The last valid colour is still what the preview shows — applying it would
    // confirm a colour the field no longer displays.
    expect(getByTestId('theme-color-preview-hex')).toHaveTextContent('#0061A4');
    expect(getByTestId('theme-color-apply-button')).toBeDisabled();

    fireEvent.press(getByTestId('theme-color-apply-button'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('names the invalid state instead of failing silently', () => {
    const {getByTestId, getByText} = renderDialog();
    fireEvent.changeText(getByTestId('theme-color-hex-input'), 'not-a-colour');
    expect(getByText('Not a valid colour — Apply is disabled')).toBeTruthy();
  });

  it('re-enables Apply once the hex parses again', () => {
    const onConfirm = jest.fn();
    const {getByTestId} = renderDialog({onConfirm});
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#00FF');
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#00FF00');

    expect(getByTestId('theme-color-apply-button')).not.toBeDisabled();
    fireEvent.press(getByTestId('theme-color-apply-button'));
    expect(onConfirm).toHaveBeenCalledWith('#00FF00');
  });

  it('keeps Cancel usable while the hex is invalid', () => {
    const onDismiss = jest.fn();
    const {getByTestId} = renderDialog({onDismiss});
    fireEvent.changeText(getByTestId('theme-color-hex-input'), '#00FF');
    fireEvent.press(getByTestId('theme-color-cancel-button'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('puts the content in a scroll view so short screens can reach the actions', () => {
    const {getByTestId} = renderDialog();
    expect(getByTestId('theme-color-scroll')).toBeTruthy();
  });

  it('renders the wheel and the brightness slider', () => {
    const {getByTestId} = renderDialog();
    expect(getByTestId('theme-color-wheel')).toBeTruthy();
    expect(getByTestId('theme-color-brightness-slider')).toBeTruthy();
  });

  it('caps the dialog to the window height in landscape', () => {
    withWindow(1066, 480);
    const {UNSAFE_root} = renderDialog();
    const capped = UNSAFE_root.findAll((node) => node.props?.style !== undefined)
      .map((node) => StyleSheet.flatten(node.props.style)?.maxHeight)
      .filter((value): value is number => typeof value === 'number');

    // In landscape the wheel still fits, so the cap is what keeps the actions on
    // screen — the content scrolls underneath it.
    expect(capped.length).toBeGreaterThan(0);
    expect(Math.max(...capped)).toBeLessThanOrEqual(480);
  });

  it('shrinks the wheel on a short window instead of overflowing', () => {
    withWindow(640, 360);
    const {getByTestId} = renderDialog();
    const {width, height} = StyleSheet.flatten(getByTestId('theme-color-wheel').props.style);
    expect(width).toBeLessThan(240);
    expect(width).toBe(height);
  });

  it('still maps a wheel touch to the right hue when the wheel is scaled down', () => {
    withWindow(640, 360);
    const {getByTestId} = renderDialog({initialColor: '#FFFFFF'});
    const wheel = getByTestId('theme-color-wheel');
    const size = StyleSheet.flatten(wheel.props.style).width as number;
    expect(size).toBeLessThan(240);

    // Right edge of the wheel is hue 0 at full saturation — red — whatever the
    // rendered size is. Before the viewBox scaling this touch landed at s≈0.5.
    fireEvent(wheel, 'responderGrant', {
      nativeEvent: {locationX: size, locationY: size / 2},
      touchHistory: {
        touchBank: [],
        numberActiveTouches: 0,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: 0,
      },
    });
    expect(getByTestId('theme-color-preview-hex')).toHaveTextContent('#FF0000');
  });

  it('shows the generated dependent colours in the preview', () => {
    const {getByText} = renderDialog();
    expect(getByText('Primary')).toBeTruthy();
    expect(getByText('Container')).toBeTruthy();
    expect(getByText('Surface')).toBeTruthy();
  });
});
