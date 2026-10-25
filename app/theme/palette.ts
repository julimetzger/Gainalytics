import {normalizeHex} from './colorScience';

/**
 * The three hand-tuned palettes that shipped before GH-405. Their colour values
 * are untouched — a stored `'blue' | 'green' | 'purple'` keeps rendering exactly
 * the same scheme it always did.
 */
export const BUILT_IN_PALETTES = ['blue', 'green', 'purple'] as const;

export type BuiltInPaletteName = (typeof BUILT_IN_PALETTES)[number];

/**
 * What `settings.palette` may hold: one of the built-in names, or a
 * user-picked source colour as a `#RRGGBB` string.
 */
export type PaletteSelection = BuiltInPaletteName | (string & {});

export const DEFAULT_PALETTE: BuiltInPaletteName = 'blue';

export function isBuiltInPalette(palette?: string): palette is BuiltInPaletteName {
  return BUILT_IN_PALETTES.includes(palette as BuiltInPaletteName);
}

/**
 * Returns the normalised `#RRGGBB` source colour when the palette setting holds
 * a custom colour, or null for the built-in palettes / unset / garbage values.
 */
export function customPaletteHex(palette?: string): string | null {
  if (!palette || isBuiltInPalette(palette)) return null;
  return normalizeHex(palette);
}

/** Human readable label for the current palette setting. */
export function paletteLabel(palette?: string): string {
  const custom = customPaletteHex(palette);
  if (custom) return custom;
  const name = isBuiltInPalette(palette) ? palette : DEFAULT_PALETTE;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The three segments of the Settings "Color" row (GH-478). Blue and
 * Purple apply their built-in palette; Custom stands for every other stored
 * value — a picked colour, or the retired Green preset, which keeps rendering
 * exactly as before.
 */
export type ThemeColorChoice = 'blue' | 'purple' | 'custom';

/** Which segment a stored palette belongs to. */
export function themeColorChoice(palette?: string): ThemeColorChoice {
  const name = palette ?? DEFAULT_PALETTE;
  return name === 'blue' || name === 'purple' ? name : 'custom';
}

/**
 * What the Custom segment previews: the active palette while it is a custom
 * one, otherwise the colour last picked from the wheel (`null` if there is none).
 */
export function customChoicePalette(palette?: string, lastCustomColor?: string): PaletteSelection | null {
  if (themeColorChoice(palette) === 'custom') return palette!;
  return customPaletteHex(lastCustomColor);
}
