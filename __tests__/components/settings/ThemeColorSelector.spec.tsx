/**
 * GH-478: the single colour row — Blue / Purple / Custom as Paper
 * SegmentedButtons with a colour preview each, Custom opening the colour wheel.
 * GH-522: the row reads "Color" and each preview shows the primary colour only.
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

/** The swatch's fill — a single circle, nothing drawn inside it. */
const swatchFill = (testID: string) => {
  const swatch = screen.getByTestId(testID);
  expect(swatch.props.children).toBeUndefined();
  return StyleSheet.flatten(swatch.props.style).backgroundColor;
};

const primaryColour = (palette: string, scheme: 'light' | 'dark' = 'light') =>
  (scheme === 'dark' ? buildThemes(palette).DarkTheme : buildThemes(palette).LightThemeCombined).colors.primary;

describe('ThemeColorSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dispatchSetPalette).mockReturnValue(mockSetPalette);
    jest.mocked(useColorScheme).mockReturnValue('light');
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'blue'});
  });

  it('is one row "Color" with the segments Blue, Purple and Custom and no extra text', () => {
    renderRow();

    expect(screen.getByTestId('settings-theme-palette-row-label').props.children).toEqual('Color');
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

  it('previews Blue and Purple with their own primary colour only', () => {
    renderRow();

    expect(swatchFill('settings-palette-blue-preview')).toEqual(primaryColour('blue'));
    expect(swatchFill('settings-palette-purple-preview')).toEqual(primaryColour('purple'));
  });

  it('previews the applied custom colour on the Custom segment and names it', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: '#e91e63'});
    renderRow();

    expect(swatchFill('settings-palette-custom-preview')).toEqual(primaryColour('#e91e63'));
    expect(screen.getByLabelText('Custom #E91E63')).toBeTruthy();
  });

  it('keeps previewing the last picked colour while a built-in palette is active', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'purple', customPalette: '#E91E63'});
    renderRow();

    expect(swatchFill('settings-palette-custom-preview')).toEqual(primaryColour('#E91E63'));
    expect(checkedSegments()).toEqual([false, true, false]);
  });

  it('previews the retired Green preset on the Custom segment', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'green'});
    renderRow();

    expect(swatchFill('settings-palette-custom-preview')).toEqual(primaryColour('green'));
  });

  it('shows a palette symbol on Custom before any colour was picked', () => {
    renderRow();

    expect(() => swatchFill('settings-palette-custom-preview')).toThrow();
    expect(screen.getByLabelText('Custom')).toBeTruthy();
  });

  it('switches the previews to the dark scheme in dark mode', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'dark', palette: 'blue'});
    renderRow(MD3DarkTheme);

    expect(swatchFill('settings-palette-purple-preview')).toEqual(primaryColour('purple', 'dark'));
    expect(primaryColour('purple', 'dark')).not.toEqual(primaryColour('purple', 'light'));
  });

  it('does not mix the secondary or tertiary colour into the preview', () => {
    renderRow();

    const {secondary, tertiary} = buildThemes('blue').LightThemeCombined.colors;
    expect(swatchFill('settings-palette-blue-preview')).not.toEqual(secondary);
    expect(swatchFill('settings-palette-blue-preview')).not.toEqual(tertiary);
  });
});
