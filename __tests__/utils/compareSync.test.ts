import {
  computeAutoOffsetMs,
  computeRepTickFractions,
  computeTimelineDurationMs,
  findNextRepStartMs,
  findPrevRepStartMs,
  formatOffsetLabel,
  formatRepSyncSubtitle,
  formatSpeedLabel,
  formatTimelineTime,
  mapTimelineToVideoTimes,
} from '../../app/utils/compareSync';

const makeSegments = (startMsList: number[]) =>
  startMsList.map((startMs, i) => ({
    startMs,
    turnaroundMs: startMs + 500,
    endMs: startMs + 1000,
    repIndex: i,
  }));

describe('computeAutoOffsetMs', () => {
  it('aligns rep 1 lift-off: offset = B rep1 start − A rep1 start', () => {
    const a = makeSegments([1100, 3000]);
    const b = makeSegments([6150, 8200]);
    expect(computeAutoOffsetMs(a, b)).toBe(5050);
  });

  it('is negative when A has the longer lead-in', () => {
    expect(computeAutoOffsetMs(makeSegments([2000]), makeSegments([500]))).toBe(-1500);
  });

  it('returns 0 when either side has no reps', () => {
    expect(computeAutoOffsetMs([], makeSegments([500]))).toBe(0);
    expect(computeAutoOffsetMs(makeSegments([500]), undefined)).toBe(0);
  });
});

describe('computeTimelineDurationMs', () => {
  it('covers the longer video: A longer', () => {
    expect(computeTimelineDurationMs(12000, 9000, 2000)).toBe(12000);
  });

  it('covers the longer video: B (shifted by offset) longer', () => {
    // B is 20s but starts 5s later than A → 15s of timeline needed for B
    expect(computeTimelineDurationMs(12000, 20000, 5000)).toBe(15000);
  });

  it('a negative offset extends the timeline for B', () => {
    expect(computeTimelineDurationMs(10000, 10000, -3000)).toBe(13000);
  });

  it('never returns less than 1', () => {
    expect(computeTimelineDurationMs(0, 0, 0)).toBe(1);
  });
});

describe('mapTimelineToVideoTimes', () => {
  it('maps timeline t to A at t and B at t + offset', () => {
    expect(mapTimelineToVideoTimes(1100, 5050, 12000, 20000)).toEqual({aMs: 1100, bMs: 6150});
  });

  it('a single timeline position drives both videos (shared scrubber)', () => {
    const pos1 = mapTimelineToVideoTimes(2000, 500, 10000, 10000);
    const pos2 = mapTimelineToVideoTimes(2000, 500, 10000, 10000);
    expect(pos1).toEqual(pos2);
    expect(pos1.bMs - pos1.aMs).toBe(500);
  });

  it('clamps A to its duration when the timeline extends past it', () => {
    expect(mapTimelineToVideoTimes(14000, 5000, 12000, 20000)).toEqual({aMs: 12000, bMs: 19000});
  });

  it('clamps B to 0 when the offset maps before its start', () => {
    expect(mapTimelineToVideoTimes(500, -2000, 12000, 9000)).toEqual({aMs: 500, bMs: 0});
  });

  it('clamps B to its duration', () => {
    expect(mapTimelineToVideoTimes(11000, 5000, 12000, 9000)).toEqual({aMs: 11000, bMs: 9000});
  });
});

describe('computeRepTickFractions', () => {
  it('returns rep starts as fractions of the timeline duration', () => {
    expect(computeRepTickFractions(makeSegments([0, 3000, 6000]), 12000)).toEqual([0, 0.25, 0.5]);
  });

  it('drops ticks outside the timeline and handles empty input', () => {
    expect(computeRepTickFractions(makeSegments([6000, 15000]), 12000)).toEqual([0.5]);
    expect(computeRepTickFractions(undefined, 12000)).toEqual([]);
    expect(computeRepTickFractions(makeSegments([1000]), 0)).toEqual([]);
  });
});

describe('formatTimelineTime', () => {
  it('formats m:ss.d like the mockup', () => {
    expect(formatTimelineTime(0)).toBe('0:00.0');
    expect(formatTimelineTime(1100)).toBe('0:01.1');
    expect(formatTimelineTime(6200)).toBe('0:06.2');
    expect(formatTimelineTime(12000)).toBe('0:12.0');
    expect(formatTimelineTime(61234)).toBe('1:01.2');
  });

  it('clamps negative input to 0', () => {
    expect(formatTimelineTime(-500)).toBe('0:00.0');
  });
});

describe('formatRepSyncSubtitle', () => {
  it('describes the removed B lead-in for a positive offset', () => {
    expect(formatRepSyncSubtitle(5050)).toBe('Aligned on rep 1 lift-off — B lead-in −5.05s removed');
  });

  it('describes the removed A lead-in for a negative offset', () => {
    expect(formatRepSyncSubtitle(-1500)).toBe('Aligned on rep 1 lift-off — A lead-in −1.50s removed');
  });

  it('omits the lead-in note when already aligned', () => {
    expect(formatRepSyncSubtitle(0)).toBe('Aligned on rep 1 lift-off');
  });
});

describe('formatOffsetLabel', () => {
  it('formats signed seconds', () => {
    expect(formatOffsetLabel(5050)).toBe('+5.05s');
    expect(formatOffsetLabel(-150)).toBe('−0.15s');
    expect(formatOffsetLabel(0)).toBe('+0.00s');
  });
});

describe('findPrevRepStartMs / findNextRepStartMs', () => {
  const segments = makeSegments([1000, 4000, 7000]);

  it('next returns the first rep start after the current position', () => {
    expect(findNextRepStartMs(segments, 0)).toBe(1000);
    expect(findNextRepStartMs(segments, 1000)).toBe(4000);
    expect(findNextRepStartMs(segments, 5000)).toBe(7000);
    expect(findNextRepStartMs(segments, 7000)).toBeNull();
  });

  it('prev returns the last rep start before the current position with grace window', () => {
    expect(findPrevRepStartMs(segments, 8000)).toBe(7000);
    // within the 300ms grace window of rep 2's start → previous rep
    expect(findPrevRepStartMs(segments, 4200)).toBe(1000);
    expect(findPrevRepStartMs(segments, 6000)).toBe(4000);
    expect(findPrevRepStartMs(segments, 900)).toBeNull();
  });

  it('handles undefined segments', () => {
    expect(findPrevRepStartMs(undefined, 1000)).toBeNull();
    expect(findNextRepStartMs(undefined, 1000)).toBeNull();
  });
});

describe('formatSpeedLabel', () => {
  it('matches the detail-screen speed label format', () => {
    expect(formatSpeedLabel(1.0)).toBe('1.0');
    expect(formatSpeedLabel(0.5)).toBe('0.5');
    expect(formatSpeedLabel(0.75)).toBe('0.75');
  });
});
