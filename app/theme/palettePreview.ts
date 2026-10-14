import {buildThemes} from './buildThemes';
import {PaletteSelection, ThemeColorChoice} from './palette';
import type {ColorScheme} from './themeMode';

export interface ThemeColorChoiceOption {
  value: ThemeColorChoice;
  label: string;
  testID: string;
}

/** The segments of the Settings "Color" row, in display order. */
export const THEME_COLOR_CHOICE_OPTIONS: ThemeColorChoiceOption[] = [
  {value: 'blue', label: 'Blue', testID: 'settings-palette-blue'},
  {value: 'purple', label: 'Purple', testID: 'settings-palette-purple'},
  {value: 'custom', label: 'Custom', testID: 'settings-palette-custom'},
];

/**
 * The primary colour a segment previews (GH-522). It comes from the same
 * `buildThemes` the app renders with, in the scheme currently in effect, so the
 * swatch shows exactly the primary the palette will apply.
 */
export const palettePreviewColor = (palette: PaletteSelection, scheme: ColorScheme): string => {
  const {DarkTheme, LightThemeCombined} = buildThemes(palette);
  return (scheme === 'dark' ? DarkTheme : LightThemeCombined).colors.primary;
};
