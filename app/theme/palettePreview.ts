import {buildThemes} from './buildThemes';
import {BUILT_IN_PALETTES, BuiltInPaletteName, paletteLabel} from './palette';
import type {ColorScheme} from './themeMode';

export interface PalettePreviewColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface PalettePresetOption {
  value: BuiltInPaletteName;
  label: string;
  testID: string;
}

export const PALETTE_PRESET_OPTIONS: PalettePresetOption[] = BUILT_IN_PALETTES.map((value) => ({
  value,
  label: paletteLabel(value),
  testID: `settings-palette-${value}`,
}));

/**
 * The key colours a preset button previews. They come from the same
 * `buildThemes` the app renders with, in the scheme currently in effect, so the
 * swatch shows exactly what tapping the preset will look like.
 */
export const palettePreviewColors = (palette: BuiltInPaletteName, scheme: ColorScheme): PalettePreviewColors => {
  const {DarkTheme, LightThemeCombined} = buildThemes(palette);
  const {primary, secondary, tertiary} = (scheme === 'dark' ? DarkTheme : LightThemeCombined).colors;
  return {primary, secondary, tertiary};
};
