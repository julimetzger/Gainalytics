import {formatTrainingTimeInput, getTrainingTimeInputError, parseTrainingTimeInput} from '../../app/utils/training-times';

describe('training-times helpers', () => {
  it('formats training time input as day month year and 24 hour time', () => {
    expect(formatTrainingTimeInput(new Date(2026, 0, 27, 18, 52))).toBe('27/01/2026 18:52');
  });

  it('parses a time-only input against the current day', () => {
    expect(parseTrainingTimeInput('18:52', new Date(2026, 0, 27, 10, 0))).toEqual(new Date(2026, 0, 27, 18, 52));
  });

  it('parses a full date and time input', () => {
    expect(parseTrainingTimeInput('27/01/2026 18:52', new Date(2026, 0, 1, 10, 0))).toEqual(new Date(2026, 0, 27, 18, 52));
  });

  it('rejects invalid inputs with an inline validation message', () => {
    expect(getTrainingTimeInputError('31/02/2026 18:52', new Date(2026, 0, 1, 10, 0))).toBe('Use HH:mm or DD/MM/YYYY HH:mm.');
  });
});
