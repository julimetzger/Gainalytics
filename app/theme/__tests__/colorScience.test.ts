import {
  blend,
  contrastRatio,
  hexFromHsv,
  hexFromLch,
  hsvFromHex,
  lchOf,
  normalizeHex,
  parseColor,
  rgbToHex,
  toneOf,
} from '../colorScience';

describe('parseColor / normalizeHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseColor('#3F51B5')).toEqual({r: 63, g: 81, b: 181});
  });

  it('parses 3-digit hex', () => {
    expect(parseColor('#f0f')).toEqual({r: 255, g: 0, b: 255});
  });

  it('parses the rgb() strings used by the purple built-in theme', () => {
    expect(parseColor('rgb(220, 184, 255)')).toEqual({r: 220, g: 184, b: 255});
  });

  it('normalises to upper-case #RRGGBB', () => {
    expect(normalizeHex('#f0f')).toBe('#FF00FF');
    expect(normalizeHex('rgb(0, 97, 164)')).toBe('#0061A4');
  });

  it('returns null for non-colours', () => {
    expect(normalizeHex('green')).toBeNull();
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('')).toBeNull();
  });
});

describe('toneOf', () => {
  it('maps black and white to the tone extremes', () => {
    expect(toneOf('#000000')).toBeCloseTo(0, 5);
    expect(toneOf('#FFFFFF')).toBeCloseTo(100, 5);
  });

  it('places mid grey near tone 53', () => {
    expect(toneOf('#808080')).toBeGreaterThan(50);
    expect(toneOf('#808080')).toBeLessThan(56);
  });
});

describe('hexFromLch', () => {
  it('hits the requested tone exactly, within 8-bit rounding', () => {
    for (const tone of [10, 20, 30, 40, 50, 60, 80, 90, 95]) {
      const hex = hexFromLch(250, 48, tone);
      expect(Math.abs(toneOf(hex) - tone)).toBeLessThan(0.6);
    }
  });

  it('keeps the tone exact for out-of-gamut chroma by reducing chroma only', () => {
    // Chroma 200 is far outside sRGB at any tone.
    const hex = hexFromLch(120, 200, 40);
    expect(Math.abs(toneOf(hex) - 40)).toBeLessThan(0.6);
    expect(lchOf(hex).c).toBeLessThan(200);
  });

  it('returns pure black / white at the tone extremes', () => {
    expect(hexFromLch(30, 60, 0)).toBe('#000000');
    expect(hexFromLch(30, 60, 100)).toBe('#FFFFFF');
  });

  it('produces a neutral grey at chroma 0', () => {
    const hex = hexFromLch(0, 0, 50);
    const rgb = parseColor(hex)!;
    expect(rgb.r).toBe(rgb.g);
    expect(rgb.g).toBe(rgb.b);
  });

  it('preserves the requested hue when the chroma fits in gamut', () => {
    const hex = hexFromLch(140, 20, 50);
    expect(Math.abs(lchOf(hex).h - 140)).toBeLessThan(2);
  });
});

describe('contrastRatio', () => {
  it('gives 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('gives 1 for a colour against itself', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#FF0000', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#FF0000'),
      5,
    );
  });

  it('depends only on tone, not on hue or chroma', () => {
    // Same tones, wildly different hues -> same contrast ratio.
    const a = contrastRatio(hexFromLch(20, 60, 40), hexFromLch(20, 60, 90));
    const b = contrastRatio(hexFromLch(280, 60, 40), hexFromLch(280, 60, 90));
    expect(Math.abs(a - b)).toBeLessThan(0.1);
  });
});

describe('blend', () => {
  it('returns the base at alpha 0 and the overlay at alpha 1', () => {
    expect(blend('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(blend('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  });

  it('blends halfway', () => {
    expect(blend('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('hsv round trip', () => {
  it('round trips hex -> hsv -> hex', () => {
    for (const hex of ['#FF0000', '#00FF00', '#0000FF', '#123456', '#FFFFFF', '#000000', '#7F3F1F']) {
      expect(hexFromHsv(hsvFromHex(hex))).toBe(hex);
    }
  });

  it('maps hue 0 saturation 1 value 1 to red', () => {
    expect(rgbToHex(parseColor(hexFromHsv({h: 0, s: 1, v: 1}))!)).toBe('#FF0000');
  });

  it('maps value 0 to black for any hue', () => {
    expect(hexFromHsv({h: 200, s: 1, v: 0})).toBe('#000000');
  });
});
