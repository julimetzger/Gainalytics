import {parseRirInput, RIR_RULE_MESSAGE} from '../../app/utils/rirInput';

describe('parseRirInput (GH-466)', () => {
  it.each([
    ['0', 0],
    ['2', 2],
    ['10', 10],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['0.5', 0.5],
    [' 2.5 ', 2.5],
    ['1.333', 1.33],
  ])('accepts %p as %p', (raw, expected) => {
    expect(parseRirInput(raw)).toBe(expected);
  });

  it.each(['', ' ', '-0.5', '-1', '10.5', '11', 'abc', '1.5x', '1,5,5', '.'])('rejects %p', (raw) => {
    expect(parseRirInput(raw)).toBeNull();
  });

  it('describes decimals as allowed instead of demanding a whole number', () => {
    expect(RIR_RULE_MESSAGE).toContain('0 to 10');
    expect(RIR_RULE_MESSAGE).toContain('decimals like 1.5 are allowed');
    expect(RIR_RULE_MESSAGE).not.toContain('whole number');
  });
});
