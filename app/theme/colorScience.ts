/**
 * Colour maths for the dynamic theme system.
 *
 * Everything here is pure sRGB <-> CIELAB conversion plus a gamut-safe
 * "tone" lookup. Tone is CIE L* (0 = black, 100 = white), which is exactly
 * what Material 3 calls the *tone* of a tonal palette.
 *
 * The important property we rely on for readability: the WCAG relative
 * luminance of a colour is the Y component of its XYZ value, and L* is a
 * function of Y alone. So the contrast ratio between two colours depends
 * ONLY on their tones — never on their hue or chroma. Picking role tones
 * per the Material 3 spec therefore guarantees readable text for *any*
 * source colour the user can pick from the wheel.
 */

export interface Rgb {
  /** 0–255 */
  r: number;
  /** 0–255 */
  g: number;
  /** 0–255 */
  b: number;
}

export interface Lab {
  /** 0–100 */
  l: number;
  a: number;
  b: number;
}

export interface Lch {
  /** 0–100 */
  l: number;
  /** >= 0 */
  c: number;
  /** degrees, 0–360 */
  h: number;
}

export interface Hsv {
  /** degrees, 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  v: number;
}

const WHITE_X = 95.047;
const WHITE_Y = 100.0;
const WHITE_Z = 108.883;

const EPSILON = 216 / 24389; // 0.008856
const KAPPA = 24389 / 27; // 903.2963

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Parses `#rgb`, `#rrggbb` and `rgb(r, g, b)` strings. Returns null when unparseable. */
export function parseColor(input: string): Rgb | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: clamp(parseInt(rgbMatch[1], 10), 0, 255),
      g: clamp(parseInt(rgbMatch[2], 10), 0, 255),
      b: clamp(parseInt(rgbMatch[3], 10), 0, 255),
    };
  }

  let hex = trimmed.replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return null;

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function channelToHex(value: number): string {
  const rounded = Math.round(clamp(value, 0, 255));
  return rounded.toString(16).padStart(2, '0').toUpperCase();
}

export function rgbToHex({r, g, b}: Rgb): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

/**
 * Normalises any parseable colour string to `#RRGGBB` (upper case).
 * Returns null when the input is not a colour.
 */
export function normalizeHex(input: string): string | null {
  const rgb = parseColor(input);
  return rgb ? rgbToHex(rgb) : null;
}

function srgbToLinear(channel0to255: number): number {
  const c = clamp(channel0to255, 0, 255) / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(linear: number): number {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return c * 255;
}

function labF(t: number): number {
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

function labFInverse(t: number): number {
  const cubed = t * t * t;
  return cubed > EPSILON ? cubed : (116 * t - 16) / KAPPA;
}

export function rgbToLab(rgb: Rgb): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100;

  const fx = labF(x / WHITE_X);
  const fy = labF(y / WHITE_Y);
  const fz = labF(z / WHITE_Z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Converts Lab to *linear* sRGB without clamping, so callers can tell whether
 * the colour is inside the sRGB gamut.
 */
function labToLinearRgb(lab: Lab): {r: number; g: number; b: number} {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  const x = (WHITE_X * labFInverse(fx)) / 100;
  const y = (WHITE_Y * labFInverse(fy)) / 100;
  const z = (WHITE_Z * labFInverse(fz)) / 100;

  return {
    r: x * 3.2404542 + y * -1.5371385 + z * -0.4985314,
    g: x * -0.969266 + y * 1.8760108 + z * 0.041556,
    b: x * 0.0556434 + y * -0.2040259 + z * 1.0572252,
  };
}

export function labToRgb(lab: Lab): Rgb {
  const linear = labToLinearRgb(lab);
  return {
    r: linearToSrgb(clamp(linear.r, 0, 1)),
    g: linearToSrgb(clamp(linear.g, 0, 1)),
    b: linearToSrgb(clamp(linear.b, 0, 1)),
  };
}

function isInGamut(lab: Lab): boolean {
  const {r, g, b} = labToLinearRgb(lab);
  const tolerance = 0.0001;
  return (
    r >= -tolerance && r <= 1 + tolerance &&
    g >= -tolerance && g <= 1 + tolerance &&
    b >= -tolerance && b <= 1 + tolerance
  );
}

export function labToLch(lab: Lab): Lch {
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return {l: lab.l, c, h};
}

export function lchToLab(lch: Lch): Lab {
  const radians = (lch.h * Math.PI) / 180;
  return {
    l: lch.l,
    a: Math.cos(radians) * lch.c,
    b: Math.sin(radians) * lch.c,
  };
}

/** L* (0–100) of a colour. This is the Material 3 "tone". */
export function toneOf(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  return rgbToLab(rgb).l;
}

export function lchOf(color: string): Lch {
  const rgb = parseColor(color);
  if (!rgb) return {l: 0, c: 0, h: 0};
  return labToLch(rgbToLab(rgb));
}

/**
 * Renders a colour at the requested hue/chroma/tone, reducing chroma (never
 * tone) until the result fits into sRGB. Keeping the tone exact is what makes
 * the contrast guarantees of the generated scheme hold.
 */
export function hexFromLch(hue: number, chroma: number, tone: number): string {
  const l = clamp(tone, 0, 100);
  if (l <= 0) return '#000000';
  if (l >= 100) return '#FFFFFF';

  const requested = Math.max(0, chroma);
  if (requested === 0) {
    return rgbToHex(labToRgb({l, a: 0, b: 0}));
  }

  if (isInGamut(lchToLab({l, c: requested, h: hue}))) {
    return rgbToHex(labToRgb(lchToLab({l, c: requested, h: hue})));
  }

  // Binary search the largest in-gamut chroma for this tone and hue.
  let low = 0;
  let high = requested;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (isInGamut(lchToLab({l, c: mid, h: hue}))) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return rgbToHex(labToRgb(lchToLab({l, c: low, h: hue})));
}

/** WCAG relative luminance (0–1). */
export function relativeLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Opaque blend of `overlay` over `base` at the given alpha (0–1). */
export function blend(base: string, overlay: string, alpha: number): string {
  const baseRgb = parseColor(base);
  const overlayRgb = parseColor(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const a = clamp(alpha, 0, 1);
  return rgbToHex({
    r: baseRgb.r + (overlayRgb.r - baseRgb.r) * a,
    g: baseRgb.g + (overlayRgb.g - baseRgb.g) * a,
    b: baseRgb.b + (overlayRgb.b - baseRgb.b) * a,
  });
}

export function hsvToRgb({h, s, v}: Hsv): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  };
}

export function rgbToHsv(rgb: Rgb): Hsv {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;

  return {h, s: max === 0 ? 0 : delta / max, v: max};
}

export function hexFromHsv(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}

export function hsvFromHex(hex: string): Hsv {
  const rgb = parseColor(hex);
  return rgb ? rgbToHsv(rgb) : {h: 0, s: 0, v: 0};
}
