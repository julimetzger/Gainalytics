import {
  buildWorkoutSetFromDraft,
  getPlanRangeError,
  getPlanSetDraft,
  getQuickEditError,
  isPlanFieldValueValid,
  parsePlanFieldValue,
} from '../../../../app/components/Training/plan/planUtils';
import {formatPlanFieldValue} from '../../../../app/utils/planRange';
import {matchesRirPreset} from '../../../../app/utils/video-analysis-filters';

// GH-466: RIR may carry decimals (1.5), typed with point or comma, range 0-10.

describe('fractional RIR input', () => {
  it.each(['1.5', '1,5', '0', '0.5', '10', '2'])('accepts %s', (raw) => {
    expect(isPlanFieldValueValid('rir', raw)).toBe(true);
  });

  it.each(['-0.5', '10.5', '11', 'abc', '', ' '])('rejects %s', (raw) => {
    expect(isPlanFieldValueValid('rir', raw)).toBe(false);
  });

  it('parses without rounding to a whole number', () => {
    expect(parsePlanFieldValue('rir', '1.5')).toBe(1.5);
    expect(parsePlanFieldValue('rir', '1,5')).toBe(1.5);
    expect(parsePlanFieldValue('rir', '2')).toBe(2);
  });

  it('keeps reps whole-number only', () => {
    expect(isPlanFieldValueValid('reps', '5.5')).toBe(false);
  });

  it('error message names decimals as allowed, not "whole number"', () => {
    const message = getQuickEditError(undefined, 'rir', '11');
    expect(message).toContain('decimals');
    expect(message).not.toContain('whole number');
    expect(getQuickEditError(undefined, 'rir', '1,5')).toBeUndefined();
  });

  it('builds a set with fractional RIR and range bound', () => {
    const built = buildWorkoutSetFromDraft(
      {reps: '8', rir: '1,5', weight: '100', repsMax: '', rirMax: '2.5', weightMax: ''},
      {index: 1, reps: 0, rir: 0, weight: 0},
    );
    expect(built).toEqual({index: 1, reps: 8, rir: 1.5, weight: 100, rirMax: 2.5});
    expect(getPlanRangeError('rir', '1.5', '1.5')).toContain('greater than 1.5');
  });

  it('displays as typed: 1.5 stays 1.5, whole numbers get no ".0"', () => {
    expect(getPlanSetDraft({index: 1, reps: 8, rir: 1.5, weight: 100}).rir).toBe('1.5');
    expect(formatPlanFieldValue({index: 1, reps: 8, rir: 1.5, weight: 100}, 'rir')).toBe('1.5');
    expect(formatPlanFieldValue({index: 1, reps: 8, rir: 2, weight: 100}, 'rir')).toBe('2');
    expect(formatPlanFieldValue({index: 1, reps: 8, rir: 1.5, rirMax: 2.5, weight: 100}, 'rir')).toBe('1.5-2.5');
  });

  it('video-analysis RIR chips match a fractional RIR to its neighbours', () => {
    expect(matchesRirPreset('1.5', '1')).toBe(true);
    expect(matchesRirPreset('1.5', '2')).toBe(true);
    expect(matchesRirPreset('1.5', '3')).toBe(false);
    expect(matchesRirPreset('2', '2')).toBe(true);
    expect(matchesRirPreset('2', '1')).toBe(false);
  });
});
