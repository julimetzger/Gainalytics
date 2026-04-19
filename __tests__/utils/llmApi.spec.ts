import {DEFAULT_ANTHROPIC_MODEL, getAnthropicModel, setAnthropicModel} from '../../app/utils/llmApi';

describe('llmApi model management', () => {
  afterEach(() => {
    // Reset to default after each test
    setAnthropicModel(DEFAULT_ANTHROPIC_MODEL);
  });

  it('getAnthropicModel returns DEFAULT_ANTHROPIC_MODEL initially', () => {
    expect(getAnthropicModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(getAnthropicModel().length).toBeGreaterThan(0);
  });

  it('setAnthropicModel persists a custom model that getAnthropicModel returns', () => {
    setAnthropicModel('claude-opus-4-7');
    expect(getAnthropicModel()).toBe('claude-opus-4-7');
  });

  it('setAnthropicModel resets to default when given empty string', () => {
    setAnthropicModel('claude-opus-4-7');
    setAnthropicModel('');
    expect(getAnthropicModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it('setAnthropicModel resets to default when given whitespace-only string', () => {
    setAnthropicModel('claude-opus-4-7');
    setAnthropicModel('   ');
    expect(getAnthropicModel()).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it('DEFAULT_ANTHROPIC_MODEL is a non-empty string', () => {
    expect(typeof DEFAULT_ANTHROPIC_MODEL).toBe('string');
    expect(DEFAULT_ANTHROPIC_MODEL.trim().length).toBeGreaterThan(0);
  });
});
