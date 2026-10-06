/**
 * GH-462: the three colour presets as a segmented control with a preview.
 *
 * Rendered against the real react-native-paper so the selected state and the
 * per-segment testIDs come from Paper's ToggleButton itself.
 */
import React from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import {MD3DarkTheme, MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
import {fireEvent, render, screen} from '@testing-library/react-native';
import ThemePaletteSelector from '../../../app/components/settings/ThemePaletteSelector';
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

const renderSelector = (theme: typeof MD3LightTheme = MD3LightTheme) =>
  render(
    <PaperProvider theme={theme}>
      <ThemePaletteSelector />
    </PaperProvider>,
  );

/** Paper puts the testID on the ripple; the fill sits on the IconButton surface around it. */
const backgroundOf = (testID: string) => {
  let node: {props: {style?: unknown}; parent: unknown} | null = screen.getByTestId(testID);
  while (node) {
    const background = StyleSheet.flatten(node.props.style)?.backgroundColor;
    if (background !== undefined) return background;
    node = node.parent as typeof node;
  }
  return undefined;
};

/** The swatch's three fills, top half first, then bottom-left and bottom-right. */
const swatchFills = (testID: string) => {
  const [top, bottom] = screen.getByTestId(testID).props.children;
  const fill = (node: {props: {style: unknown}}) => StyleSheet.flatten(node.props.style).backgroundColor;
  return [fill(top), ...bottom.props.children.map(fill)];
};

describe('ThemePaletteSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dispatchSetPalette).mockReturnValue(mockSetPalette);
    jest.mocked(useColorScheme).mockReturnValue('light');
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'blue'});
  });

  it('marks the stored preset as selected and names it', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: 'green'});
    renderSelector();

    const selection = ['blue', 'green', 'purple'].map(
      (name) => screen.getByTestId(`settings-palette-${name}`).props.accessibilityState.selected,
    );
    expect(selection).toEqual([false, true, false]);
    expect(screen.getByTestId('settings-theme-palette-active').props.children).toEqual('Active: Green');
  });

  it('applies a preset with one tap', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('settings-palette-purple'));

    expect(mockSetPalette).toHaveBeenCalledWith('purple');
  });

  it('keeps the preset when its own segment is pressed again', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('settings-palette-blue'));

    expect(mockSetPalette).not.toHaveBeenCalled();
  });

  it('selects no preset while a custom colour is applied', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'light', palette: '#e91e63'});
    renderSelector();

    const selection = ['blue', 'green', 'purple'].map(
      (name) => screen.getByTestId(`settings-palette-${name}`).props.accessibilityState.selected,
    );
    expect(selection).toEqual([false, false, false]);
    expect(screen.getByTestId('settings-theme-palette-active').props.children).toEqual('Active: Custom #E91E63');
  });

  it('previews each preset with its own key colours in the scheme in effect', () => {
    renderSelector();

    for (const name of ['blue', 'green', 'purple'] as const) {
      const {primary, secondary, tertiary} = buildThemes(name).LightThemeCombined.colors;
      expect(swatchFills(`settings-palette-${name}-preview`)).toEqual([primary, secondary, tertiary]);
    }
  });

  it('switches the preview to the dark scheme in dark mode', () => {
    mockedUseSettings.mockReturnValue({themeMode: 'dark', palette: 'blue'});
    renderSelector(MD3DarkTheme);

    const {primary, secondary, tertiary} = buildThemes('green').DarkTheme.colors;
    expect(swatchFills('settings-palette-green-preview')).toEqual([primary, secondary, tertiary]);
    expect(primary).not.toEqual(buildThemes('green').LightThemeCombined.colors.primary);
  });

  it('fills only the selected segment, with the theme accent', () => {
    // Two themes, so a hardcoded colour cannot pass.
    const light = renderSelector(MD3LightTheme);
    expect(backgroundOf('settings-palette-blue')).toEqual(MD3LightTheme.colors.secondaryContainer);
    expect(backgroundOf('settings-palette-green')).toEqual('transparent');
    light.unmount();

    renderSelector(MD3DarkTheme);
    expect(backgroundOf('settings-palette-blue')).toEqual(MD3DarkTheme.colors.secondaryContainer);
  });
});
