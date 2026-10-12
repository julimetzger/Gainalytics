import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';
import {resolveAiProvider} from '../../../app/models/AiProvider';

describe('GH-504 AI provider settings', () => {
  const existingUser = {
    mode: 'light',
    palette: 'blue',
    anthropicModel: 'claude-opus-5',
  } satisfies AppSettings;

  it('keeps existing users on Claude: no provider stored resolves to claude', () => {
    expect(resolveAiProvider(undefined)).toBe('claude');
    expect(resolveAiProvider('something-else')).toBe('claude');
    expect(resolveAiProvider('chatgpt')).toBe('chatgpt');
  });

  it('stores the provider choice without touching the Claude settings', () => {
    expect(settingsReducer(existingUser, {type: 'SET_AI_PROVIDER', provider: 'chatgpt'})).toEqual({
      ...existingUser,
      aiProvider: 'chatgpt',
    });
    expect(settingsReducer(existingUser, {type: 'SET_AI_PROVIDER', provider: 'bogus'})).toEqual({
      ...existingUser,
      aiProvider: 'claude',
    });
  });

  it('stores a trimmed ChatGPT model and clears it when empty', () => {
    const withModel = settingsReducer(existingUser, {type: 'SET_CHATGPT_MODEL', model: '  gpt-x '});
    expect(withModel).toEqual({...existingUser, chatgptModel: 'gpt-x'});
    expect(settingsReducer(withModel, {type: 'SET_CHATGPT_MODEL', model: ''})).toEqual({...existingUser, chatgptModel: undefined});
  });
});
