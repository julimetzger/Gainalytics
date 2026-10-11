import {buildThemes} from './buildThemes';
import {PaletteSelection, ThemeColorChoice} from './palette';
import type {ColorScheme} from './themeMode';

export interface PalettePreviewColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface ThemeColorChoiceOption {
  value: ThemeColorChoice;
  label: string;
  testID: string;
}

/** The segments of the Settings "Custom Color" row, in display order. */
export const THEME_COLOR_CHOICE_OPTIONS: ThemeColorChoiceOption[] = [
  {value: 'blue', label: 'Blue', testID: 'settings-palette-blue'},
  {value: 'purple', label: 'Purple', testID: 'settings-palette-purple'},
  {value: 'custom', label: 'Custom', testID: 'settings-palette-custom'},
];

/**
 * The key colours a segment previews. They come from the same `buildThemes`
 * the app renders with, in the scheme currently in effect, so the swatch shows
 * exactly what the palette will look like.
 */
export const palettePreviewColors = (palette: PaletteSelection, scheme: ColorScheme): PalettePreviewColors => {
  const {DarkTheme, LightThemeCombined} = buildThemes(palette);
  const {primary, secondary, tertiary} = (scheme === 'dark' ? DarkTheme : LightThemeCombined).colors;
  return {primary, secondary, tertiary};
};
