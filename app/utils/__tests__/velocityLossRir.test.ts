import {
  formatVlReferenceLabel,
  globalAnchorVlPercent,
  hasRirDiscrepancy,
  isValidReferenceRir,
  isVlReferenceActive,
  vlReferenceScaleFactor,
  vlThresholdsFor,
  vlToRirEstimate,
} from '../velocityLossRir';
import {VelocityLossReference} from '../../models/entities/Exercise';

describe('vlToRirEstimate', () => {
  it('returns 4+ for VL < 10%', () => {
    expect(vlToRirEstimate(0)).toBe('4+');
    expect(vlToRirEstimate(9)).toBe('4+');
    expect(vlToRirEstimate(9.9)).toBe('4+');
  });

  it('returns 3-4 for 10 <= VL < 20%', () => {
    expect(vlToRirEstimate(10)).toBe('3-4');
    expect(vlToRirEstimate(15)).toBe('3-4');
    expect(vlToRirEstimate(19.9)).toBe('3-4');
  });

  it('returns 2-3 for 20 <= VL < 30%', () => {
    expect(vlToRirEstimate(20)).toBe('2-3');
    expect(vlToRirEstimate(25)).toBe('2-3');
    expect(vlToRirEstimate(29.9)).toBe('2-3');
  });

  it('returns 1-2 for 30 <= VL < 40%', () => {
    expect(vlToRirEstimate(30)).toBe('1-2');
    expect(vlToRirEstimate(35)).toBe('1-2');
    expect(vlToRirEstimate(39.9)).toBe('1-2');
  });

  it('returns 0-1 for VL >= 40%', () => {
    expect(vlToRirEstimate(40)).toBe('0-1');
    expect(vlToRirEstimate(60)).toBe('0-1');
    expect(vlToRirEstimate(100)).toBe('0-1');
  });
});

describe('hasRirDiscrepancy', () => {
  describe('VL < 10% → estimated RIR 4+', () => {
    it('no discrepancy when reported RIR >= 4', () => {
      expect(hasRirDiscrepancy(4, 5)).toBe(false);
      expect(hasRirDiscrepancy(5, 5)).toBe(false);
      expect(hasRirDiscrepancy(10, 0)).toBe(false);
    });

    it('discrepancy when reported RIR < 4', () => {
      expect(hasRirDiscrepancy(3, 5)).toBe(true);
      expect(hasRirDiscrepancy(0, 5)).toBe(true);
    });
  });

  describe('10 <= VL < 20% → estimated RIR 3-4', () => {
    it('no discrepancy when reported RIR is 3 or 4', () => {
      expect(hasRirDiscrepancy(3, 15)).toBe(false);
      expect(hasRirDiscrepancy(4, 15)).toBe(false);
    });

    it('discrepancy when reported RIR outside 3-4', () => {
      expect(hasRirDiscrepancy(2, 15)).toBe(true);
      expect(hasRirDiscrepancy(5, 15)).toBe(true);
    });
  });

  describe('20 <= VL < 30% → estimated RIR 2-3', () => {
    it('no discrepancy when reported RIR is 2 or 3', () => {
      expect(hasRirDiscrepancy(2, 25)).toBe(false);
      expect(hasRirDiscrepancy(3, 25)).toBe(false);
    });

    it('discrepancy when reported RIR outside 2-3', () => {
      expect(hasRirDiscrepancy(1, 25)).toBe(true);
      expect(hasRirDiscrepancy(4, 25)).toBe(true);
    });
  });

  describe('30 <= VL < 40% → estimated RIR 1-2', () => {
    it('no discrepancy when reported RIR is 1 or 2', () => {
      expect(hasRirDiscrepancy(1, 35)).toBe(false);
      expect(hasRirDiscrepancy(2, 35)).toBe(false);
    });

    it('discrepancy when reported RIR outside 1-2', () => {
      expect(hasRirDiscrepancy(0, 35)).toBe(true);
      expect(hasRirDiscrepancy(3, 35)).toBe(true);
    });
  });

  describe('VL >= 40% → estimated RIR 0-1', () => {
    it('no discrepancy when reported RIR is 0 or 1', () => {
      expect(hasRirDiscrepancy(0, 50)).toBe(false);
      expect(hasRirDiscrepancy(1, 50)).toBe(false);
    });

    it('discrepancy when reported RIR > 1', () => {
      expect(hasRirDiscrepancy(2, 50)).toBe(true);
      expect(hasRirDiscrepancy(3, 50)).toBe(true);
    });
  });
});

// --- GH-316: per-exercise VL reference -------------------------------------------------

const reference = (rir: number, velocityLossPercent: number): VelocityLossReference => ({
  rir,
  velocityLossPercent,
  referencedAt: '2026-03-15T10:00:00.000Z',
  analysisId: 1,
});

describe('globalAnchorVlPercent', () => {
  it('returns the centre of the band that represents each allowed anchor RIR', () => {
    expect([0, 1, 2, 3].map(globalAnchorVlPercent)).toEqual([45, 35, 25, 15]);
  });

  it('returns null for RIR outside the allowed anchor range', () => {
    expect([-1, 4, 5, 1.5, NaN].map(globalAnchorVlPercent)).toEqual([null, null, null, null, null]);
  });
});

describe('isValidReferenceRir', () => {
  it('accepts only integers 0 to 3', () => {
    expect([0, 1, 2, 3].map(isValidReferenceRir)).toEqual([true, true, true, true]);
    expect([-1, 4, 10, 2.5, NaN, undefined, null].map(isValidReferenceRir)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('vlReferenceScaleFactor', () => {
  it('is the measured VL relative to what the global curve expects for that RIR', () => {
    expect(vlReferenceScaleFactor(reference(1, 14))).toBeCloseTo(14 / 35, 10);
    expect(vlReferenceScaleFactor(reference(3, 30))).toBeCloseTo(30 / 15, 10);
  });

  it('is null — i.e. the global curve stays in charge — for unusable references', () => {
    expect(vlReferenceScaleFactor(undefined)).toBeNull();
    expect(vlReferenceScaleFactor(reference(4, 20))).toBeNull();
    expect(vlReferenceScaleFactor(reference(-1, 20))).toBeNull();
    expect(vlReferenceScaleFactor(reference(1, 0))).toBeNull();
    expect(vlReferenceScaleFactor(reference(1, -5))).toBeNull();
    expect(vlReferenceScaleFactor(reference(1, NaN))).toBeNull();
  });
});

describe('vlThresholdsFor', () => {
  it('returns the untouched global thresholds without a reference', () => {
    expect(vlThresholdsFor(undefined)).toEqual([10, 20, 30, 40]);
  });

  it('scales every threshold by the same factor', () => {
    // RIR 1 anchored at 14% VL where the global curve expects 35% → factor 0.4
    expect(vlThresholdsFor(reference(1, 14))).toEqual([4, 8, 12, 16]);
  });

  it('leaves the global thresholds untouched for an unusable reference', () => {
    expect(vlThresholdsFor(reference(4, 20))).toEqual([10, 20, 30, 40]);
  });
});

describe('vlToRirEstimate with a VL reference', () => {
  it('maps the reference set itself back onto the RIR it was anchored at', () => {
    // For every allowed anchor and a range of measured VLs, the anchored set must
    // land in a band that contains the confirmed RIR.
    for (const rir of [0, 1, 2, 3]) {
      for (const measuredVl of [3, 7.5, 14.29, 22, 38, 55]) {
        expect(vlToRirEstimate(measuredVl, reference(rir, measuredVl))).toBe(
          rir === 0 ? '0-1' : `${rir}-${rir + 1}`,
        );
      }
    }
  });

  it('shifts the estimate for the same VL once the exercise is referenced', () => {
    // The baseline evidence case: 14.29% VL reads as RIR 3-4 globally…
    expect(vlToRirEstimate(14.29)).toBe('3-4');
    // …and as RIR 1-2 for an athlete who confirmed RIR 1 at that velocity loss.
    expect(vlToRirEstimate(14.29, reference(1, 14.29))).toBe('1-2');
  });

  it('scales the whole curve, not just the anchor point', () => {
    const ref = reference(1, 14); // factor 0.4 → thresholds [4, 8, 12, 16]
    expect(vlToRirEstimate(3, ref)).toBe('4+');
    expect(vlToRirEstimate(4, ref)).toBe('3-4');
    expect(vlToRirEstimate(8, ref)).toBe('2-3');
    expect(vlToRirEstimate(12, ref)).toBe('1-2');
    expect(vlToRirEstimate(16, ref)).toBe('0-1');
  });

  it('falls back to the global curve for an unusable reference', () => {
    expect(vlToRirEstimate(14.29, reference(4, 14.29))).toBe('3-4');
    expect(vlToRirEstimate(14.29, reference(1, 0))).toBe('3-4');
  });
});

describe('hasRirDiscrepancy with a VL reference', () => {
  it('never flags the reference set against its own confirmed RIR', () => {
    for (const rir of [0, 1, 2, 3]) {
      for (const measuredVl of [3, 14.29, 22, 55]) {
        expect(hasRirDiscrepancy(rir, measuredVl, reference(rir, measuredVl))).toBe(false);
      }
    }
  });

  it('warns against the referenced thresholds, not the global ones', () => {
    const ref = reference(1, 14.29); // 14.29% VL now means RIR 1-2
    // Globally 14.29% is RIR 3-4, so a reported RIR of 4 looks fine…
    expect(hasRirDiscrepancy(4, 14.29)).toBe(false);
    // …but for this athlete that VL means they were near failure — flag it.
    expect(hasRirDiscrepancy(4, 14.29, ref)).toBe(true);
    expect(hasRirDiscrepancy(2, 14.29, ref)).toBe(false);
  });

  it('leaves an unreferenced exercise exactly as it is today', () => {
    expect(hasRirDiscrepancy(4, 14.29, undefined)).toBe(false);
    expect(hasRirDiscrepancy(0, 14.29, undefined)).toBe(true);
  });
});

describe('isVlReferenceActive / formatVlReferenceLabel', () => {
  it('reports an active reference and labels it with its RIR and date', () => {
    const ref = reference(2, 20);
    expect(isVlReferenceActive(ref)).toBe(true);
    expect(formatVlReferenceLabel(ref, 'en-US')).toBe('VL reference · RIR 2 · 3/15/2026');
  });

  it('reports nothing for a missing or unusable reference', () => {
    expect(isVlReferenceActive(undefined)).toBe(false);
    expect(formatVlReferenceLabel(undefined)).toBeNull();
    expect(isVlReferenceActive(reference(4, 20))).toBe(false);
    expect(formatVlReferenceLabel(reference(4, 20))).toBeNull();
  });
});
