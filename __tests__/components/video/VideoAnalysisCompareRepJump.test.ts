import {computeRepSeekPositions} from '../../../app/tabs/Analyse/VideoAnalysisCompareTab';

const makeSegments = (startMsList: number[]) =>
  startMsList.map((startMs, i) => ({
    startMs,
    turnaroundMs: startMs + 500,
    endMs: startMs + 1000,
    repIndex: i,
  }));

describe('computeRepSeekPositions', () => {
  it('returns null when result1 has no segment at repIndex', () => {
    const result1 = {repSegments: makeSegments([0, 1000])};
    expect(computeRepSeekPositions(result1, undefined, 5)).toBeNull();
  });

  it('returns seekMs1 from result1 and seekMs2 from result2 at the same index', () => {
    // Video A rep 0 starts at 0ms, Video B rep 0 starts at 200ms (different pacing)
    const result1 = {repSegments: makeSegments([0, 1100, 2200])};
    const result2 = {repSegments: makeSegments([200, 1400, 2700])};

    const pos = computeRepSeekPositions(result1, result2, 0);
    expect(pos).not.toBeNull();
    expect(pos!.seekMs1).toBe(0);
    expect(pos!.seekMs2).toBe(200);
  });

  it('uses independent seek positions for each rep index', () => {
    const result1 = {repSegments: makeSegments([0, 1100, 2200])};
    const result2 = {repSegments: makeSegments([300, 1600, 3000])};

    const pos1 = computeRepSeekPositions(result1, result2, 1);
    expect(pos1!.seekMs1).toBe(1100);
    expect(pos1!.seekMs2).toBe(1600);

    const pos2 = computeRepSeekPositions(result1, result2, 2);
    expect(pos2!.seekMs1).toBe(2200);
    expect(pos2!.seekMs2).toBe(3000);
  });

  it('falls back to seekMs1 value when result2 is undefined', () => {
    const result1 = {repSegments: makeSegments([500, 1500])};
    const pos = computeRepSeekPositions(result1, undefined, 0);
    expect(pos!.seekMs1).toBe(500);
    expect(pos!.seekMs2).toBe(500);
  });

  it('falls back to seekMs1 value when result2 has fewer reps', () => {
    // result1 has 3 reps, result2 only has 2 — rep index 2 missing in result2
    const result1 = {repSegments: makeSegments([0, 1000, 2000])};
    const result2 = {repSegments: makeSegments([100, 1100])};

    const pos = computeRepSeekPositions(result1, result2, 2);
    expect(pos!.seekMs1).toBe(2000);
    // Falls back to result1's time since result2 has no segment at index 2
    expect(pos!.seekMs2).toBe(2000);
  });
});
