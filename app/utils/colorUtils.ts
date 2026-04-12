/**
 * Returns a color string with the given alpha (0–1) applied.
 * Handles both hex (#rrggbb / #rgb) and rgb(r, g, b) input formats,
 * producing a valid rgba(r, g, b, alpha) output in both cases.
 *
 * This is necessary because react-native-paper theme colors use rgb(...)
 * strings (not hex), so a naive `color + '33'` concatenation produces an
 * invalid value like "rgb(220, 184, 255)33" that crashes React Native.
 */
export function withAlpha(color: string, alpha: number): string {
  const trimmed = color.trim();

  // rgb(r, g, b) or rgba(r, g, b, a) — strip the alpha part if present
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/,
  );
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }

  // #rrggbb or #rgb
  let hex = trimmed.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Fallback: return the original color unchanged (better than a crash)
  return color;
}
