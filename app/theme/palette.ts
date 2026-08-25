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
