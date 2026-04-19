import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';
import {DEFAULT_ANTHROPIC_MODEL} from '../../../app/utils/llmApi';

describe('anthropicModel in settingsReducer', () => {
  it('returns DEFAULT_ANTHROPIC_MODEL when no model is stored (empty storage / first launch)', () => {
    const state = settingsReducer(undefined, {type: '@@INIT'});
    const model = state.anthropicModel && state.anthropicModel.trim()
      ? state.anthropicModel
      : DEFAULT_ANTHROPIC_MODEL;
    expect(model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(model.length).toBeGreaterThan(0);
  });

  it('passes through a custom model string unchanged', () => {
    const initial: AppSettings = {mode: 'dark'};
    const action = {type: 'SET_ANTHROPIC_MODEL', model: 'claude-opus-4-7'};
    const next = settingsReducer(initial, action);
    expect(next.anthropicModel).toBe('claude-opus-4-7');
  });

  it('resets to undefined (triggering default fallback) when blank input is saved', () => {
    const initial: AppSettings = {mode: 'dark', anthropicModel: 'claude-opus-4-7'};
    const action = {type: 'SET_ANTHROPIC_MODEL', model: '   '};
    const next = settingsReducer(initial, action);
    expect(next.anthropicModel).toBeUndefined();
    const resolved = next.anthropicModel && next.anthropicModel.trim()
      ? next.anthropicModel
      : DEFAULT_ANTHROPIC_MODEL;
    expect(resolved).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it('trims whitespace from saved model value', () => {
    const initial: AppSettings = {mode: 'dark'};
    const action = {type: 'SET_ANTHROPIC_MODEL', model: '  claude-sonnet-4-6  '};
    const next = settingsReducer(initial, action);
    expect(next.anthropicModel).toBe('claude-sonnet-4-6');
  });

  it('does not modify other settings fields when setting the model', () => {
    const initial: AppSettings = {
      mode: 'light',
      palette: 'green',
      toggles: {disableTimer: true},
    };
    const action = {type: 'SET_ANTHROPIC_MODEL', model: 'claude-haiku-4-5-20251001'};
    const next = settingsReducer(initial, action);
    expect(next.mode).toBe('light');
    expect(next.palette).toBe('green');
    expect(next.toggles?.disableTimer).toBe(true);
  });
});
