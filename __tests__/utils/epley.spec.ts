import {epley1RM, repsCoefficient} from '../../app/utils/AnalyseUtils';

describe('epley1RM', () => {
  it('returns 0 when weight or reps are non-positive', () => {
    expect(epley1RM(0, 5, 1)).toBe(0);
    expect(epley1RM(100, 0, 1)).toBe(0);
  });

  it('returns the weight directly for a 1-rep max with no RIR', () => {
    expect(epley1RM(100, 1, 0)).toBe(100);
  });

  it('matches Epley with reps + RIR added together', () => {
    // weight=95, reps=8, rir=2 → 95 * (1 + 10/30) = 126.666...
    expect(epley1RM(95, 8, 2)).toBeCloseTo(95 * (1 + 10 / 30));
  });

  it('exposes repsCoefficient with reps + rir treatment matching the existing utility', () => {
    expect(repsCoefficient(1)).toBe(1);
    expect(repsCoefficient(10)).toBeCloseTo(1 + 10 / 30);
  });
});
