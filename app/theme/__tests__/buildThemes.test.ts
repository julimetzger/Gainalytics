import {MD3DarkTheme, MD3LightTheme} from 'react-native-paper';
import {buildThemes} from '../buildThemes';
import {toneOf} from '../colorScience';

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
