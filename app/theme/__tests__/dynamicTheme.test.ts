import {contrastRatio, lchOf, normalizeHex, toneOf} from '../colorScience';
import {
  buildDynamicSchemes,
  buildPalettes,
  DynamicScheme,
  READABILITY_PAIRS,
} from '../dynamicTheme';

/**
 * A spread of source colours covering the extremes named in the ticket:
 * very light, very dark, heavily saturated, plus achromatic and ordinary picks.
 */
const SOURCE_COLORS = [
  '#0061A4', // the default blue
  '#63A002', // the built-in green seed
  '#7845AC', // the built-in purple primary
  '#FFF7B2', // very light
  '#FFFFFF', // white
  '#0A0A12', // very dark
  '#000000', // black
  '#FF00E5', // neon magenta
  '#00FF00', // neon green
  '#FF0000',
  '#808080', // achromatic
  '#123456',
  '#E91E63',
];

const ON_ROLE_TONES_LIGHT: Array<[keyof DynamicScheme, number]> = [
  ['primary', 40],
  ['onPrimary', 100],
  ['primaryContainer', 90],
  ['onPrimaryContainer', 10],
  ['surface', 98],
  ['onSurface', 10],
];

const ON_ROLE_TONES_DARK: Array<[keyof DynamicScheme, number]> = [
  ['primary', 80],
  ['onPrimary', 20],
  ['primaryContainer', 30],
  ['onPrimaryContainer', 90],
  ['surface', 6],
  ['onSurface', 90],
];

describe('buildPalettes', () => {
  it('derives the tertiary palette 60 degrees from the source hue', () => {
    const source = '#0061A4';
    const palettes = buildPalettes(source);
    const sourceHue = lchOf(source).h;
    expect(palettes.tertiary.hue).toBeCloseTo((sourceHue + 60) % 360, 5);
  });

  it('keeps neutrals nearly grey', () => {
    const palettes = buildPalettes('#FF00E5');
    expect(palettes.neutral.chroma).toBeLessThanOrEqual(6);
    expect(palettes.neutralVariant.chroma).toBeLessThanOrEqual(10);
  });

  it('produces a fully neutral theme for an achromatic source', () => {
    const palettes = buildPalettes('#808080');
    expect(palettes.primary.chroma).toBe(0);
    expect(palettes.secondary.chroma).toBe(0);
    expect(palettes.tertiary.chroma).toBe(0);
  });

  it('keeps a vivid source vivid', () => {
    const vivid = buildPalettes('#FF00E5');
    const muted = buildPalettes('#7A6A75');
    expect(vivid.primary.chroma).toBeGreaterThan(muted.primary.chroma);
  });

  it('uses a fixed error palette so errors always read as errors', () => {
    expect(buildPalettes('#00FF00').error.hue).toBe(buildPalettes('#FF00E5').error.hue);
  });

  it('falls back to the default blue for an unparseable source', () => {
    expect(buildPalettes('not-a-color').primary.hue).toBeCloseTo(
      buildPalettes('#0061A4').primary.hue,
      5,
    );
  });
});

describe('buildDynamicSchemes', () => {
  it('assigns the Material 3 role tones in light mode', () => {
    const {light} = buildDynamicSchemes('#0061A4');
    for (const [role, tone] of ON_ROLE_TONES_LIGHT) {
      expect(Math.abs(toneOf(light[role] as string) - tone)).toBeLessThan(1);
    }
  });

  it('assigns the Material 3 role tones in dark mode', () => {
    const {dark} = buildDynamicSchemes('#0061A4');
    for (const [role, tone] of ON_ROLE_TONES_DARK) {
      expect(Math.abs(toneOf(dark[role] as string) - tone)).toBeLessThan(1);
    }
  });

  it.each(SOURCE_COLORS)('keeps text readable on every surface for %s', (source) => {
    const schemes = buildDynamicSchemes(source);
    const failures: string[] = [];
    for (const mode of ['light', 'dark'] as const) {
      const scheme = schemes[mode];
      for (const [foreground, background] of READABILITY_PAIRS) {
        const ratio = contrastRatio(scheme[foreground] as string, scheme[background] as string);
        // WCAG AA for normal text.
        if (ratio < 4.5) {
          failures.push(`${mode}: ${foreground} on ${background} = ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it.each(SOURCE_COLORS)('emits a valid hex or rgba for every role for %s', (source) => {
    const schemes = buildDynamicSchemes(source);
    for (const mode of ['light', 'dark'] as const) {
      const scheme = schemes[mode] as unknown as Record<string, unknown>;
      for (const [role, value] of Object.entries(scheme)) {
        if (role === 'elevation') continue;
        expect(typeof value).toBe('string');
        expect(value as string).toMatch(/^(#[0-9A-F]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/);
      }
    }
  });

  it('produces distinct light and dark schemes', () => {
    const {light, dark} = buildDynamicSchemes('#E91E63');
    expect(toneOf(light.surface)).toBeGreaterThan(toneOf(dark.surface));
    expect(toneOf(light.onSurface)).toBeLessThan(toneOf(dark.onSurface));
  });

  it('builds elevation overlays that stay close to the surface', () => {
    const {dark} = buildDynamicSchemes('#E91E63');
    expect(dark.elevation.level0).toBe('transparent');
    expect(normalizeHex(dark.elevation.level1)).not.toBeNull();
    // Higher elevation = more primary tint = lighter than the base surface in dark mode.
    expect(toneOf(dark.elevation.level5)).toBeGreaterThan(toneOf(dark.surface));
  });

  it('is deterministic', () => {
    expect(buildDynamicSchemes('#E91E63')).toEqual(buildDynamicSchemes('#e91e63'));
  });

  it('derives the primary hue from the source colour', () => {
    const {light} = buildDynamicSchemes('#E91E63');
    expect(Math.abs(lchOf(light.primary).h - lchOf('#E91E63').h)).toBeLessThan(3);
  });
});
