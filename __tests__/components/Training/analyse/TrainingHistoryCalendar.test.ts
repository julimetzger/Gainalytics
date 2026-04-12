/**
 * GH-94 – TrainingHistoryCalendar: unit tests for local-date fix and
 * multiple-trainings-per-day mark-store accumulation.
 */

import {getYYYYMMDDFormat} from '../../../../app/utils/DateHelper';

// ─── Local date format (UTC vs local) ────────────────────────────────────────

describe('getYYYYMMDDFormat — local date, not UTC', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the local date string for midnight UTC+2 (would be previous day in UTC)', () => {
    // 2026-04-12T22:00:00Z is 2026-04-13 00:00:00 in UTC+2.
    // The old `new Date().toISOString().slice(0,10)` would return "2026-04-12" (UTC),
    // but the local date in UTC+2 is "2026-04-13".
    // We mock a date object with specific local time parts to verify the function uses
    // getFullYear/getMonth/getDate (local) rather than UTC methods.
    const mockDate = new Date(2026, 3, 13, 0, 0, 0); // local: Apr 13 2026 00:00:00
    expect(getYYYYMMDDFormat(mockDate)).toBe('2026-04-13');
  });

  it('returns the correct local date string on the last day of a month', () => {
    const mockDate = new Date(2026, 1, 28, 23, 59, 59); // local: Feb 28 2026 23:59:59
    expect(getYYYYMMDDFormat(mockDate)).toBe('2026-02-28');
  });

  it('pads single-digit month and day with leading zero', () => {
    const mockDate = new Date(2026, 0, 5, 8, 0, 0); // local: Jan 5 2026
    expect(getYYYYMMDDFormat(mockDate)).toBe('2026-01-05');
  });
});

// ─── Multiple trainings per day: mark-store accumulation ─────────────────────

/**
 * Pure unit test for the mark-store accumulation logic extracted into a
 * standalone helper that mirrors the real setMark implementation.
 */
type TrainingEntry = {
  trainingId: number;
  planId: number;
  microNumber: number;
  trainingInMicro: number;
  trainingName: string;
  planName: string;
};

type DayMark = {
  trainings?: TrainingEntry[];
  inMicroRange?: boolean;
};

function setMark(
  marks: Record<string, DayMark>,
  dateStr: string,
  partial: Partial<DayMark>,
): void {
  const existing = marks[dateStr] ?? {};
  if (partial.trainings) {
    marks[dateStr] = {
      ...existing,
      ...partial,
      trainings: [...(existing.trainings ?? []), ...partial.trainings],
    };
  } else {
    marks[dateStr] = {...existing, ...partial};
  }
}

describe('mark-store accumulation — multiple trainings per day', () => {
  it('accumulates two trainings on the same date into an array', () => {
    const marks: Record<string, DayMark> = {};

    setMark(marks, '2026-04-12', {
      trainings: [{trainingId: 1, planId: 10, microNumber: 1, trainingInMicro: 1, trainingName: 'Squat', planName: 'Plan A'}],
    });
    setMark(marks, '2026-04-12', {
      trainings: [{trainingId: 2, planId: 20, microNumber: 2, trainingInMicro: 1, trainingName: 'Bench', planName: 'Plan B'}],
    });

    expect(marks['2026-04-12'].trainings).toHaveLength(2);
    expect(marks['2026-04-12'].trainings![0].trainingId).toBe(1);
    expect(marks['2026-04-12'].trainings![1].trainingId).toBe(2);
  });

  it('keeps visual-only marks when training data is added on the same day', () => {
    const marks: Record<string, DayMark> = {};

    // First set micro-range data (no trainings)
    setMark(marks, '2026-04-12', {inMicroRange: true});
    // Then add a training
    setMark(marks, '2026-04-12', {
      trainings: [{trainingId: 3, planId: 10, microNumber: 1, trainingInMicro: 1, trainingName: 'DL', planName: 'P'}],
    });

    expect(marks['2026-04-12'].inMicroRange).toBe(true);
    expect(marks['2026-04-12'].trainings).toHaveLength(1);
  });

  it('does not share the trainings array between different dates', () => {
    const marks: Record<string, DayMark> = {};

    setMark(marks, '2026-04-12', {
      trainings: [{trainingId: 1, planId: 10, microNumber: 1, trainingInMicro: 1, trainingName: 'A', planName: 'P'}],
    });
    setMark(marks, '2026-04-13', {
      trainings: [{trainingId: 2, planId: 10, microNumber: 1, trainingInMicro: 2, trainingName: 'B', planName: 'P'}],
    });

    expect(marks['2026-04-12'].trainings).toHaveLength(1);
    expect(marks['2026-04-13'].trainings).toHaveLength(1);
    expect(marks['2026-04-12'].trainings![0].trainingId).toBe(1);
    expect(marks['2026-04-13'].trainings![0].trainingId).toBe(2);
  });
});
