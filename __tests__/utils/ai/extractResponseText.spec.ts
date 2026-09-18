import {extractResponseText} from '../../../app/utils/ai/extractResponseText';

describe('extractResponseText', () => {
  it('reads a plain single text block', () => {
    expect(extractResponseText({content: [{type: 'text', text: 'Add a set to your rows.'}]})).toBe(
      'Add a set to your rows.',
    );
  });

  // GH-449 as observed on device: claude-opus-5 returned its answer behind a thinking block,
  // and reading content[0].text produced an empty Coach Insight under "Generated just now".
  it('skips a leading thinking block and returns the answer', () => {
    const data = {
      content: [
        {type: 'thinking', thinking: 'The athlete trained chest twice…'},
        {type: 'text', text: 'Your squat volume stalled for three weeks.'},
      ],
    };
    expect(extractResponseText(data)).toBe('Your squat volume stalled for three weeks.');
  });

  it('joins an answer that arrives split across several text blocks', () => {
    const data = {
      content: [
        {type: 'text', text: 'Squat volume stalled. '},
        {type: 'text', text: 'Add one set per week.'},
      ],
    };
    expect(extractResponseText(data)).toBe('Squat volume stalled. Add one set per week.');
  });

  it('ignores non-text blocks that carry no answer', () => {
    const data = {
      content: [
        {type: 'redacted_thinking', data: 'encrypted'},
        {type: 'tool_use', id: 'x', name: 'calc', input: {}},
        {type: 'text', text: 'Keep pushing.'},
      ],
    };
    expect(extractResponseText(data)).toBe('Keep pushing.');
  });

  it('accepts a block without a type, so existing fixtures keep working', () => {
    expect(extractResponseText({content: [{text: 'Keep pushing!'}]})).toBe('Keep pushing!');
  });

  it('returns an empty string for a response with no text at all', () => {
    expect(extractResponseText({content: [{type: 'thinking', thinking: 'hmm'}]})).toBe('');
    expect(extractResponseText({content: []})).toBe('');
  });

  it('returns an empty string for a malformed or missing response body', () => {
    expect(extractResponseText(undefined)).toBe('');
    expect(extractResponseText(null)).toBe('');
    expect(extractResponseText({})).toBe('');
    expect(extractResponseText({content: 'not a list'})).toBe('');
    expect(extractResponseText({content: [null, {type: 'text'}]})).toBe('');
  });
});
