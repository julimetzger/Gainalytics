/**
 * Builds a complete Material 3 colour scheme (light + dark) from a single
 * source colour picked by the user.
 *
 * The generation follows the Material 3 tonal-palette model:
 *   1. Derive five tonal palettes (primary, secondary, tertiary, neutral,
 *      neutral-variant) plus the fixed error palette from the source colour.
 *   2. Assign every scheme role a fixed *tone* from those palettes, using the
 *      tones defined by the Material 3 spec.
 *
 * Because contrast depends only on tone (see `colorScience.ts`), every
 * on-colour/surface pair below has the same contrast ratio no matter which
 * colour the user picks — that is what keeps text readable for very light,
 * very dark and heavily saturated source colours alike.
 */

import {blend, hexFromLch, lchOf, normalizeHex} from './colorScience';

export interface TonalPalette {
  hue: number;
  chroma: number;
  /** Returns the palette colour at the given tone (0–100) as `#RRGGBB`. */
  tone(tone: number): string;
}

export interface DynamicPalettes {
  primary: TonalPalette;
  secondary: TonalPalette;
  tertiary: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  error: TonalPalette;
}

export interface ElevationColors {
  /** Paper's `MD3ElevationColors` is keyed by the numeric enum as well. */
  [numericLevel: number]: string;
  level0: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
}

export interface DynamicScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceTint: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  surfaceDisabled: string;
  onSurfaceDisabled: string;
  backdrop: string;
  elevation: ElevationColors;
}

/** A colour is treated as achromatic below this chroma — it yields a neutral theme. */
const ACHROMATIC_CHROMA = 4;

/** Alpha of the primary tint used for the Material 3 elevation overlays. */
const ELEVATION_ALPHAS = [0, 0.05, 0.08, 0.11, 0.12, 0.14];

function makePalette(hue: number, chroma: number): TonalPalette {
  return {
    hue,
    chroma,
    tone: (t: number) => hexFromLch(hue, chroma, t),
  };
}

/**
 * Derives the five tonal palettes from the source colour.
 *
 * Chroma is derived from the source rather than fixed, so a vivid pick stays
 * vivid and a muted pick stays muted, with a floor that keeps very desaturated
 * picks from collapsing into grey. A source colour that is essentially grey
 * produces a fully neutral (monochrome) theme instead of an arbitrary hue.
 */
export function buildPalettes(sourceHex: string): DynamicPalettes {
  const normalized = normalizeHex(sourceHex) ?? '#0061A4';
  const {c, h} = lchOf(normalized);

  const achromatic = c < ACHROMATIC_CHROMA;
  const hue = achromatic ? 0 : h;

  const primaryChroma = achromatic ? 0 : Math.max(c, 32);
  const secondaryChroma = achromatic ? 0 : Math.max(c / 3, 16);
  const tertiaryChroma = achromatic ? 0 : Math.max(c / 2, 24);
  const neutralChroma = achromatic ? 0 : Math.min(c / 12, 6);
  const neutralVariantChroma = achromatic ? 0 : Math.min(c / 6, 10);

  return {
    primary: makePalette(hue, primaryChroma),
    secondary: makePalette(hue, secondaryChroma),
    tertiary: makePalette((hue + 60) % 360, tertiaryChroma),
    neutral: makePalette(hue, neutralChroma),
    neutralVariant: makePalette(hue, neutralVariantChroma),
    // The error palette is intentionally fixed: an error must read as an error
    // regardless of the chosen theme colour.
    error: makePalette(25, 84),
  };
}

function withAlphaHex(hex: string, alpha: number): string {
  const normalized = normalizeHex(hex) ?? '#000000';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function elevationFor(surface: string, tint: string): ElevationColors {
  const [, l1, l2, l3, l4, l5] = ELEVATION_ALPHAS;
  return {
    level0: 'transparent',
    level1: blend(surface, tint, l1),
    level2: blend(surface, tint, l2),
    level3: blend(surface, tint, l3),
    level4: blend(surface, tint, l4),
    level5: blend(surface, tint, l5),
  };
}

function lightScheme(p: DynamicPalettes): DynamicScheme {
  const surface = p.neutral.tone(98);
  const onSurface = p.neutral.tone(10);
  const primary = p.primary.tone(40);

  return {
    primary,
    onPrimary: p.primary.tone(100),
    primaryContainer: p.primary.tone(90),
    onPrimaryContainer: p.primary.tone(10),
    secondary: p.secondary.tone(40),
    onSecondary: p.secondary.tone(100),
    secondaryContainer: p.secondary.tone(90),
    onSecondaryContainer: p.secondary.tone(10),
    tertiary: p.tertiary.tone(40),
    onTertiary: p.tertiary.tone(100),
    tertiaryContainer: p.tertiary.tone(90),
    onTertiaryContainer: p.tertiary.tone(10),
    error: p.error.tone(40),
    onError: p.error.tone(100),
    errorContainer: p.error.tone(90),
    onErrorContainer: p.error.tone(10),
    background: surface,
    onBackground: onSurface,
    surface,
    onSurface,
    surfaceVariant: p.neutralVariant.tone(90),
    onSurfaceVariant: p.neutralVariant.tone(30),
    surfaceTint: primary,
    outline: p.neutralVariant.tone(50),
    outlineVariant: p.neutralVariant.tone(80),
    shadow: p.neutral.tone(0),
    scrim: p.neutral.tone(0),
    inverseSurface: p.neutral.tone(20),
    inverseOnSurface: p.neutral.tone(95),
    inversePrimary: p.primary.tone(80),
    surfaceDisabled: withAlphaHex(onSurface, 0.12),
    onSurfaceDisabled: withAlphaHex(onSurface, 0.38),
    backdrop: withAlphaHex(p.neutralVariant.tone(20), 0.4),
    elevation: elevationFor(surface, primary),
  };
}

function darkScheme(p: DynamicPalettes): DynamicScheme {
  const surface = p.neutral.tone(6);
  const onSurface = p.neutral.tone(90);
  const primary = p.primary.tone(80);

  return {
    primary,
    onPrimary: p.primary.tone(20),
    primaryContainer: p.primary.tone(30),
    onPrimaryContainer: p.primary.tone(90),
    secondary: p.secondary.tone(80),
    onSecondary: p.secondary.tone(20),
    secondaryContainer: p.secondary.tone(30),
    onSecondaryContainer: p.secondary.tone(90),
    tertiary: p.tertiary.tone(80),
    onTertiary: p.tertiary.tone(20),
    tertiaryContainer: p.tertiary.tone(30),
    onTertiaryContainer: p.tertiary.tone(90),
    error: p.error.tone(80),
    onError: p.error.tone(20),
    errorContainer: p.error.tone(30),
    onErrorContainer: p.error.tone(90),
    background: surface,
    onBackground: onSurface,
    surface,
    onSurface,
    surfaceVariant: p.neutralVariant.tone(30),
    onSurfaceVariant: p.neutralVariant.tone(80),
    surfaceTint: primary,
    outline: p.neutralVariant.tone(60),
    outlineVariant: p.neutralVariant.tone(30),
    shadow: p.neutral.tone(0),
    scrim: p.neutral.tone(0),
    inverseSurface: p.neutral.tone(90),
    inverseOnSurface: p.neutral.tone(20),
    inversePrimary: p.primary.tone(40),
    surfaceDisabled: withAlphaHex(onSurface, 0.12),
    onSurfaceDisabled: withAlphaHex(onSurface, 0.38),
    backdrop: withAlphaHex(p.neutralVariant.tone(20), 0.4),
    elevation: elevationFor(surface, primary),
  };
}

export interface DynamicThemeSchemes {
  light: DynamicScheme;
  dark: DynamicScheme;
}

/** Builds the full light + dark scheme pair for a user-picked source colour. */
export function buildDynamicSchemes(sourceHex: string): DynamicThemeSchemes {
  const palettes = buildPalettes(sourceHex);
  return {light: lightScheme(palettes), dark: darkScheme(palettes)};
}

/**
 * Pairs of (foreground role, background role) that must stay readable.
 * Exported so the unit tests can assert the contrast contract directly.
 */
export const READABILITY_PAIRS: ReadonlyArray<[keyof DynamicScheme, keyof DynamicScheme]> = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onError', 'error'],
  ['onErrorContainer', 'errorContainer'],
  ['onBackground', 'background'],
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surfaceVariant'],
  ['inverseOnSurface', 'inverseSurface'],
];
