import {formatRestDisplay, formatTarget} from '../../app/utils/restTimer';

describe('restTimer formatters', () => {
  describe('formatRestDisplay', () => {
    it('counts down while remaining > 0', () => {
      const snap = formatRestDisplay(90, 18);
      expect(snap).toEqual({
        state: 'counting',
        display: '01:12',
        elapsedSeconds: 18,
        remainingSeconds: 72,
      });
    });

    it('switches to overrun at exactly target', () => {
      const snap = formatRestDisplay(90, 90);
      expect(snap).toEqual({
        state: 'overrun',
        display: '+00:00',
        elapsedSeconds: 90,
        remainingSeconds: 0,
      });
    });

    it('shows + prefix when overrunning', () => {
      const snap = formatRestDisplay(90, 98);
      expect(snap).toEqual({
        state: 'overrun',
        display: '+00:08',
        elapsedSeconds: 98,
        remainingSeconds: -8,
      });
    });

    it('handles target of zero as idle', () => {
      const snap = formatRestDisplay(0, 50);
      expect(snap).toEqual({
        state: 'idle',
        display: '00:00',
        elapsedSeconds: 0,
        remainingSeconds: 0,
      });
    });
  });

  describe('formatTarget', () => {
    it('formats seconds into mm:ss', () => {
      expect(formatTarget(90)).toBe('01:30');
      expect(formatTarget(7)).toBe('00:07');
      expect(formatTarget(0)).toBe('00:00');
    });
  });
});
