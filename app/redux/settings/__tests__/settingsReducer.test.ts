import settingsReducer from '../settingsReducer';

describe('settingsReducer', () => {
  it('should set lastAnalysisSecondsPerVideoSecond', () => {
    const state = settingsReducer(undefined, {
      type: 'SET_LAST_ANALYSIS_SECONDS_PER_VIDEO_SECOND',
      value: 1.5,
    });

    expect(state.lastAnalysisSecondsPerVideoSecond).toBe(1.5);
  });

  it('should update lastAnalysisSecondsPerVideoSecond on subsequent analyses', () => {
    const state1 = settingsReducer(undefined, {
      type: 'SET_LAST_ANALYSIS_SECONDS_PER_VIDEO_SECOND',
      value: 1.5,
    });

    const state2 = settingsReducer(state1, {
      type: 'SET_LAST_ANALYSIS_SECONDS_PER_VIDEO_SECOND',
      value: 0.8,
    });

    expect(state2.lastAnalysisSecondsPerVideoSecond).toBe(0.8);
  });

  it('should not affect other settings when updating analysis rate', () => {
    const state = settingsReducer({mode: 'dark', palette: 'purple'}, {
      type: 'SET_LAST_ANALYSIS_SECONDS_PER_VIDEO_SECOND',
      value: 2.0,
    });

    expect(state.mode).toBe('dark');
    expect(state.palette).toBe('purple');
    expect(state.lastAnalysisSecondsPerVideoSecond).toBe(2.0);
  });
});
