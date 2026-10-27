import {configureStore} from '@reduxjs/toolkit';
import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';
import rootReducer from '../../../app/redux/rootReducer';
import {DEFAULT_VIDEO_ANALYSIS_FPS, resolveVideoAnalysisFps, VIDEO_ANALYSIS_FPS_OPTIONS} from '../../../app/models/VideoAnalysisFps';

describe('GH-621 video analysis frame rate setting', () => {
  const existingUser = {
    mode: 'dark',
    palette: 'blue',
    videoAnalysisFiltersExpanded: true,
  } satisfies AppSettings;

  it('offers 15, 20 and 30 FPS and defaults to 30', () => {
    expect(VIDEO_ANALYSIS_FPS_OPTIONS).toEqual([15, 20, 30]);
    expect(DEFAULT_VIDEO_ANALYSIS_FPS).toBe(30);
  });

  it('resolves a missing or invalid stored value to the default', () => {
    expect(resolveVideoAnalysisFps(undefined)).toBe(30);
    expect(resolveVideoAnalysisFps(null)).toBe(30);
    expect(resolveVideoAnalysisFps(25)).toBe(30);
    expect(resolveVideoAnalysisFps(0)).toBe(30);
    expect(resolveVideoAnalysisFps(Number.NaN)).toBe(30);
    expect(resolveVideoAnalysisFps('15')).toBe(30);
    expect(resolveVideoAnalysisFps([])).toBe(30);
  });

  it('keeps every supported choice', () => {
    expect(resolveVideoAnalysisFps(15)).toBe(15);
    expect(resolveVideoAnalysisFps(20)).toBe(20);
    expect(resolveVideoAnalysisFps(30)).toBe(30);
  });

  it('a fresh install stores nothing, so the setting reads as the default', () => {
    const settings = settingsReducer(undefined, {type: '@@INIT'});

    expect(settings.videoAnalysisFps).toBeUndefined();
    expect(resolveVideoAnalysisFps(settings.videoAnalysisFps)).toBe(30);
  });

  it('stores the chosen rate without touching the other settings', () => {
    expect(settingsReducer(existingUser, {type: 'SET_VIDEO_ANALYSIS_FPS', fps: 15})).toEqual({
      ...existingUser,
      videoAnalysisFps: 15,
    });
  });

  it('stores the default instead of an invalid rate', () => {
    expect(settingsReducer({...existingUser, videoAnalysisFps: 15}, {type: 'SET_VIDEO_ANALYSIS_FPS', fps: 24})).toEqual({
      ...existingUser,
      videoAnalysisFps: 30,
    });
  });

  it('is part of the full-state export (the whole store is written) and survives a full import', () => {
    const store = configureStore({reducer: rootReducer});
    store.dispatch({type: 'SET_VIDEO_ANALYSIS_FPS', fps: 20});
    const exported = JSON.parse(JSON.stringify(store.getState()));

    expect(exported.settings.videoAnalysisFps).toBe(20);

    const restored = configureStore({reducer: rootReducer});
    restored.dispatch({type: 'FULL_IMPORT', state: exported});

    expect(restored.getState().settings.videoAnalysisFps).toBe(20);
  });
});
