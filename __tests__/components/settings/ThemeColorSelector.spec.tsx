/**
 * GH-478: the single "Custom Color" row — Blue / Purple / Custom as Paper
 * SegmentedButtons with a colour preview each, Custom opening the colour wheel.
 *
 * Rendered against the real react-native-paper so the checked state and the
 * per-segment testIDs come from Paper's SegmentedButtons itself.
 */
import React from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import {MD3DarkTheme, MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
import {fireEvent, render, screen} from '@testing-library/react-native';
import ThemeColorSelector from '../../../app/components/settings/ThemeColorSelector';
import {useSettings} from '../../../app/redux/settings/use/useSettings';
import {dispatchSetPalette} from '../../../app/redux/settings/dispatch/dispatchSetPalette';
import {buildThemes} from '../../../app/theme/buildThemes';

const mockSetPalette = jest.fn();

jest.mock('../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetPalette', () => ({
  dispatchSetPalette: jest.fn(() => mockSetPalette),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const mockedUseSettings = jest.mocked(useSettings);

const renderRow = (theme: typeof MD3LightTheme = MD3LightTheme) =>
  render(
    <PaperProvider theme={theme}>
      <ThemeColorSelector />
    </PaperProvider>,
  );

const SEGMENTS = ['blue', 'purple', 'custom'];
const checkedSegments = () =>
  SEGMENTS.map((name) => screen.getByTestId(`settings-palette-${name}`).props.accessibilityState.checked);

/** The swatch's three fills, top half first, then bottom-left and bottom-right. */
const swatchFills = (testID: string) => {
  const [top, bottom] = screen.getByTestId(testID).props.children;
  const fill = (node: {props: {style: unknown}}) => StyleSheet.flatten(node.props.style).backgroundColor;
  return [fill(top), ...bottom.props.children.map(fill)];
};

const keyColours = (palette: string, scheme: 'light' | 'dark' = 'light') => {
  const {primary, secondary, tertiary} = (scheme === 'dark' ? buildThemes(palette).DarkTheme : buildThemes(palette).LightThemeCombined).colors;
  return [primary, secondary, tertiary];
};

describe('ThemeColorSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dispatchSetPalette).mockReturnValue(mockSetPalette);
    jest.mocked(useColorScheme).mockReturnValue('light');
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'blue'});
  });

  it('is one row "Custom Color" with the segments Blue, Purple and Custom and no extra text', () => {
    renderRow();

    expect(screen.getByTestId('settings-theme-palette-row-label').props.children).toEqual('Custom Color');
    expect(SEGMENTS.map((name) => screen.getByTestId(`settings-palette-${name}-label`).props.children)).toEqual([
      'Blue',
      'Purple',
      'Custom',
    ]);
    expect(screen.queryByText(/^Active:/)).toBeNull();
    expect(screen.queryByText('Pick any color')).toBeNull();
    expect(screen.queryByTestId('settings-palette-green')).toBeNull();
  });

  it.each([
    ['blue', [true, false, false]],
    ['purple', [false, true, false]],
    ['#e91e63', [false, false, true]],
    // The retired Green preset keeps rendering green and counts as a custom colour.
    ['green', [false, false, true]],
    [undefined, [true, false, false]],
  ])('checks the matching segment for a stored palette of %s', (palette, expected) => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette});
    renderRow();

    expect(checkedSegments()).toEqual(expected);
  });

  it('applies Blue and Purple with one tap', () => {
    renderRow();

    fireEvent.press(screen.getByTestId('settings-palette-purple'));
    expect(mockSetPalette).toHaveBeenLastCalledWith('purple');

    fireEvent.press(screen.getByTestId('settings-palette-blue'));
    expect(mockSetPalette).toHaveBeenLastCalledWith('blue');
  });

  it('opens the colour wheel on Custom and applies the confirmed colour', () => {
    renderRow();
    expect(screen.queryByTestId('theme-color-hex-input')).toBeNull();

    fireEvent.press(screen.getByTestId('settings-palette-custom'));

    expect(screen.getByText('Pick a theme colour')).toBeTruthy();
    expect(mockSetPalette).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('theme-color-hex-input'), '#E91E63');
    fireEvent.press(screen.getByTestId('theme-color-apply-button'));

    expect(mockSetPalette).toHaveBeenCalledWith('#E91E63');
  });

  it('reopens the wheel on the applied custom colour', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: '#e91e63'});
    renderRow();

    fireEvent.press(screen.getByTestId('settings-palette-custom'));

    expect(screen.getByTestId('theme-color-preview-hex').props.children).toEqual('#E91E63');
  });

  it('does not apply an invalid hex', () => {
    renderRow();
    fireEvent.press(screen.getByTestId('settings-palette-custom'));

    fireEvent.changeText(screen.getByTestId('theme-color-hex-input'), '#00FF');
    fireEvent.press(screen.getByTestId('theme-color-apply-button'));

    expect(mockSetPalette).not.toHaveBeenCalled();
  });

  it('previews Blue and Purple with their own key colours', () => {
    renderRow();

    expect(swatchFills('settings-palette-blue-preview')).toEqual(keyColours('blue'));
    expect(swatchFills('settings-palette-purple-preview')).toEqual(keyColours('purple'));
  });

  it('previews the applied custom colour on the Custom segment and names it', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: '#e91e63'});
    renderRow();

    expect(swatchFills('settings-palette-custom-preview')).toEqual(keyColours('#e91e63'));
    expect(screen.getByLabelText('Custom #E91E63')).toBeTruthy();
  });

  it('keeps previewing the last picked colour while a built-in palette is active', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'purple', customPalette: '#E91E63'});
    renderRow();

    expect(swatchFills('settings-palette-custom-preview')).toEqual(keyColours('#E91E63'));
    expect(checkedSegments()).toEqual([false, true, false]);
  });

  it('previews the retired Green preset on the Custom segment', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'green'});
    renderRow();

    expect(swatchFills('settings-palette-custom-preview')).toEqual(keyColours('green'));
  });

  it('shows a palette symbol on Custom before any colour was picked', () => {
    renderRow();

    expect(() => swatchFills('settings-palette-custom-preview')).toThrow();
    expect(screen.getByLabelText('Custom')).toBeTruthy();
  });

  it('switches the previews to the dark scheme in dark mode', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'dark', palette: 'blue'});
    renderRow(MD3DarkTheme);

    expect(swatchFills('settings-palette-purple-preview')).toEqual(keyColours('purple', 'dark'));
    expect(keyColours('purple', 'dark')).not.toEqual(keyColours('purple', 'light'));
  });
});
