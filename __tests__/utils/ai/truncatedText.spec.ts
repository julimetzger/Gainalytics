import {
  TRUNCATION_NOTICE,
  isTruncatedStopReason,
  trimToCompleteText,
} from '../../../app/utils/ai/truncatedText';

describe('isTruncatedStopReason', () => {
  it('is true only for the API\'s max_tokens stop reason', () => {
    expect(isTruncatedStopReason('max_tokens')).toBe(true);
    expect(isTruncatedStopReason('end_turn')).toBe(false);
    expect(isTruncatedStopReason('stop_sequence')).toBe(false);
    expect(isTruncatedStopReason(undefined)).toBe(false);
  });
});

describe('trimToCompleteText', () => {
  // GH-449: this is the exact shape the user reported — the advice broke off inside "hamstrings".
  it('drops the half-written final word reported in GH-449', () => {
    expect(
      trimToCompleteText('Your quads are progressing while hamst'),
    ).toBe('Your quads are progressing while…');
  });

  it('falls back to the last complete sentence when there is one', () => {
    expect(
      trimToCompleteText('Squat volume stalled for three weeks. Your bench is progressing while hamst'),
    ).toBe('Squat volume stalled for three weeks.');
  });

  it('leaves text that already ends on a sentence boundary untouched', () => {
    expect(trimToCompleteText('Add a set to your rows.')).toBe('Add a set to your rows.');
    expect(trimToCompleteText('Why not more volume?')).toBe('Why not more volume?');
  });

  it('keeps a closing markdown or quote marker after the punctuation', () => {
    expect(trimToCompleteText('Push harder on **squats.**')).toBe('Push harder on **squats.**');
  });

  it('handles a sentence ending at a newline', () => {
    expect(
      trimToCompleteText('Volume is flat.\nTry adding one set per week for hamst'),
    ).toBe('Volume is flat.');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(trimToCompleteText('')).toBe('');
    expect(trimToCompleteText('   \n ')).toBe('');
  });

  it('ellipsises a single half-written word with no boundary to fall back to', () => {
    expect(trimToCompleteText('hamst')).toBe('hamst…');
  });

  it('exposes a notice that names the cause', () => {
    expect(TRUNCATION_NOTICE).toBe('Shortened — the answer hit the length limit.');
  });
});
