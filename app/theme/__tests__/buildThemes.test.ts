import {MD3DarkTheme, MD3LightTheme} from 'react-native-paper';
import {buildThemes} from '../buildThemes';
import {contrastRatio, toneOf} from '../colorScience';

/**
 * GH-405 regression guard.
 *
 * The colour-wheel feature must not change what Blue / Green / Purple look
 * like. These tests pin the values the three built-in palettes produced before
 * the change, including Purple's long-standing quirk (its scheme is nested one
 * level deeper than Green's and Blue's, so it effectively renders Paper's
 * default MD3 palette). Preserving that quirk is deliberate: existing users
 * must see exactly what they saw yesterday.
 */
describe('buildThemes — built-in palettes are unchanged', () => {
  it('blue keeps its exported light and dark primaries', () => {
    const {LightThemeCombined, DarkTheme} = buildThemes('blue');
    expect(LightThemeCombined.colors.primary).toBe('#415F91');
    expect(LightThemeCombined.colors.primaryContainer).toBe('#D6E3FF');
    expect(DarkTheme.colors.primary).toBe('#AAC7FF');
  });

  it('green keeps its exported light and dark primaries', () => {
    const {LightThemeCombined, DarkTheme} = buildThemes('green');
    expect(LightThemeCombined.colors.primary).toBe('#4C662B');
    expect(LightThemeCombined.colors.primaryContainer).toBe('#CDEDA3');
    expect(DarkTheme.colors.primary).toBe('#B1D18A');
  });

  it('purple keeps rendering exactly what it rendered before', () => {
    const {LightThemeCombined, DarkTheme} = buildThemes('purple');
    expect(DarkTheme.colors.primary).toBe(MD3DarkTheme.colors.primary);
    expect(LightThemeCombined.colors.primary).toBe(MD3LightTheme.colors.primary);
  });

  it('falls back to blue for an unset palette, as before', () => {
    expect(buildThemes(undefined).LightThemeCombined.colors.primary).toBe(
      buildThemes('blue').LightThemeCombined.colors.primary,
    );
  });

  it('falls back to blue for a stored value that is neither a name nor a colour', () => {
    expect(buildThemes('turquoise').LightThemeCombined.colors.primary).toBe(
      buildThemes('blue').LightThemeCombined.colors.primary,
    );
  });
});

describe('buildThemes — custom source colours', () => {
  it('generates a scheme whose primary follows the picked colour', () => {
    const {LightThemeCombined, DarkTheme} = buildThemes('#E91E63');
    expect(LightThemeCombined.colors.primary).not.toBe(
      buildThemes('blue').LightThemeCombined.colors.primary,
    );
    // Material 3 role tones: primary is tone 40 in light, tone 80 in dark.
    expect(Math.abs(toneOf(LightThemeCombined.colors.primary) - 40)).toBeLessThan(1);
    expect(Math.abs(toneOf(DarkTheme.colors.primary) - 80)).toBeLessThan(1);
  });

  it('fills the navigation colours from the generated scheme', () => {
    const {DarkTheme, LightThemeCombined} = buildThemes('#00FF00');
    expect(DarkTheme.colors.card).toBe(DarkTheme.colors.background);
    expect(DarkTheme.colors.notification).toBe(DarkTheme.colors.primary);
    expect(LightThemeCombined.colors.card).toBe(LightThemeCombined.colors.background);
  });

  it('keeps the light surface light and the dark surface dark for a very light pick', () => {
    const {LightThemeCombined, DarkTheme} = buildThemes('#FFF7B2');
    expect(toneOf(LightThemeCombined.colors.surface)).toBeGreaterThan(90);
    expect(toneOf(DarkTheme.colors.surface)).toBeLessThan(15);
  });

  it('accepts lower-case and 3-digit hex from the picker', () => {
    expect(buildThemes('#f0f').LightThemeCombined.colors.primary).toBe(
      buildThemes('#FF00FF').LightThemeCombined.colors.primary,
    );
  });

  it('replaces the elevation overlays so they are tinted with the picked colour', () => {
    const custom = buildThemes('#00FF00').DarkTheme.colors.elevation;
    expect(custom.level0).toBe('transparent');
    expect(custom.level3).not.toBe(MD3DarkTheme.colors.elevation.level3);
  });
});

/**
 * GH-437: the "Finish Training" button is filled with `secondary` and labelled
 * with `onSecondary`. Every palette must therefore offer a secondary surface
 * that is both readable and visibly distinct from the primary one — otherwise
 * the recolour would be either illegible or invisible in some palette.
 */
describe('buildThemes — secondary is usable as a filled button surface', () => {
  const palettes = ['blue', 'green', 'purple'] as const;
  const modes = ['light', 'dark'] as const;

  const schemeFor = (palette: (typeof palettes)[number], mode: (typeof modes)[number]) => {
    const {LightThemeCombined, DarkTheme} = buildThemes(palette);
    return (mode === 'light' ? LightThemeCombined : DarkTheme).colors as Record<string, string>;
  };

  it.each(palettes.flatMap((p) => modes.map((m) => [p, m] as const)))(
    '%s/%s labels the secondary fill with at least WCAG AA contrast',
    (palette, mode) => {
      const colors = schemeFor(palette, mode);
      expect(colors.secondary).toBeTruthy();
      expect(colors.onSecondary).toBeTruthy();
      expect(contrastRatio(colors.onSecondary, colors.secondary)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(palettes.flatMap((p) => modes.map((m) => [p, m] as const)))(
    '%s/%s keeps secondary distinguishable from primary',
    (palette, mode) => {
      const colors = schemeFor(palette, mode);
      expect(colors.secondary).not.toBe(colors.primary);
    },
  );
});

/**
 * GH-330: the Estimated 1RM card draws its PR line and positive deltas in
 * `primary` and negative deltas in `error`, as small text on the card's
 * `surfaceContainerLow` background. Every palette — built-in and custom —
 * must keep that text readable and keep "gain" visibly different from "loss".
 */
describe('buildThemes — primary text on the 1RM card stays readable', () => {
  const palettes = ['blue', 'green', 'purple', '#E91E63', '#FFC107', '#00FF00'];
  const modes = ['light', 'dark'] as const;
  const cases = palettes.flatMap((p) => modes.map((m) => [p, m] as const));

  const schemeFor = (palette: string, mode: (typeof modes)[number]) => {
    const {LightThemeCombined, DarkTheme} = buildThemes(palette);
    return (mode === 'light' ? LightThemeCombined : DarkTheme).colors as Record<string, string>;
  };
  const cardBackground = (colors: Record<string, string>) =>
    colors.surfaceContainerLow ?? colors.surfaceVariant ?? colors.surface;

  it.each(cases)('%s/%s: primary reaches WCAG AA on the card background', (palette, mode) => {
    const colors = schemeFor(palette, mode);
    expect(contrastRatio(colors.primary, cardBackground(colors))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases)('%s/%s: error reaches WCAG AA on the card background', (palette, mode) => {
    const colors = schemeFor(palette, mode);
    expect(contrastRatio(colors.error, cardBackground(colors))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases)('%s/%s: primary is not the error colour', (palette, mode) => {
    const colors = schemeFor(palette, mode);
    expect(colors.primary.toLowerCase()).not.toBe(colors.error.toLowerCase());
  });
});
