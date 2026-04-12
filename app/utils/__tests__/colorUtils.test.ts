import {withAlpha} from '../colorUtils';

describe('withAlpha', () => {
  it('converts a 6-digit hex color to rgba', () => {
    expect(withAlpha('#558b2f', 0.2)).toBe('rgba(85, 139, 47, 0.2)');
  });

  it('converts a 3-digit hex color to rgba', () => {
    expect(withAlpha('#f0f', 0.5)).toBe('rgba(255, 0, 255, 0.5)');
  });

  it('converts an rgb() string (Purple Theme format) to rgba', () => {
    expect(withAlpha('rgb(220, 184, 255)', 0.2)).toBe(
      'rgba(220, 184, 255, 0.2)',
    );
  });

  it('converts an rgba() string and overwrites the alpha', () => {
    expect(withAlpha('rgba(220, 184, 255, 1)', 0.5)).toBe(
      'rgba(220, 184, 255, 0.5)',
    );
  });

  it('handles rgb() with extra whitespace', () => {
    expect(withAlpha('rgb( 10 , 20 , 30 )', 0.1)).toBe(
      'rgba(10, 20, 30, 0.1)',
    );
  });

  it('returns the original string unchanged for unrecognized formats', () => {
    expect(withAlpha('transparent', 0.5)).toBe('transparent');
  });
});
