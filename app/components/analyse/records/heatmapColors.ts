// Tile color helpers for the records heatmap.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | undefined {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex.trim());
  if (!match) {
    return undefined;
  }
  return {r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16)};
}

export function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Fill opacity for a tile with `count` records relative to `maxCount`. */
export function tileAlpha(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) {
    return 0;
  }
  return 0.25 + 0.75 * (count / maxCount);
}

/**
 * Readable text color for a tile: the fill (primary at `alpha` over the surface)
 * is blended and its luminance decides between dark and light text. On the dark
 * themes' pastel primaries this flips to dark text at roughly >60% intensity,
 * matching the design spec.
 */
export function tileTextColor(primaryHex: string, surfaceHex: string, alpha: number, fallback: string): string {
  const primary = hexToRgb(primaryHex);
  const surface = hexToRgb(surfaceHex);
  if (!primary || !surface) {
    return fallback;
  }
  const r = primary.r * alpha + surface.r * (1 - alpha);
  const g = primary.g * alpha + surface.g * (1 - alpha);
  const b = primary.b * alpha + surface.b * (1 - alpha);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#15171D' : '#F2F3F7';
}
