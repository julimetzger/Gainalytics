import {customPaletteHex, isBuiltInPalette, paletteLabel} from '../palette';

describe('isBuiltInPalette', () => {
  it('recognises the three shipped palettes', () => {
    expect(isBuiltInPalette('blue')).toBe(true);
    expect(isBuiltInPalette('green')).toBe(true);
    expect(isBuiltInPalette('purple')).toBe(true);
  });

  it('rejects colours and unknown values', () => {
    expect(isBuiltInPalette('#E91E63')).toBe(false);
    expect(isBuiltInPalette(undefined)).toBe(false);
    expect(isBuiltInPalette('')).toBe(false);
  });
});

describe('customPaletteHex', () => {
  it('returns null for the built-in palettes so they keep the legacy code path', () => {
    expect(customPaletteHex('blue')).toBeNull();
    expect(customPaletteHex('green')).toBeNull();
    expect(customPaletteHex('purple')).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(customPaletteHex(undefined)).toBeNull();
  });

  it('normalises a stored custom colour', () => {
    expect(customPaletteHex('#e91e63')).toBe('#E91E63');
    expect(customPaletteHex('#f0f')).toBe('#FF00FF');
  });

  it('returns null for a value that is neither a palette name nor a colour', () => {
    expect(customPaletteHex('turquoise')).toBeNull();
  });
});

describe('paletteLabel', () => {
  it('capitalises the built-in names', () => {
    expect(paletteLabel('green')).toBe('Green');
    expect(paletteLabel('blue')).toBe('Blue');
  });

  it('shows the hex for a custom colour', () => {
    expect(paletteLabel('#e91e63')).toBe('#E91E63');
  });

  it('defaults to Blue when unset', () => {
    expect(paletteLabel(undefined)).toBe('Blue');
  });
});
