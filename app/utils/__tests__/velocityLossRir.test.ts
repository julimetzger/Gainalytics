import {vlToRirEstimate, hasRirDiscrepancy} from '../velocityLossRir';

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
