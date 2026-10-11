import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';

describe('settingsReducer', () => {
  it('defaults video analysis filters to collapsed', () => {
    expect(settingsReducer(undefined, {type: '@@INIT'})).toEqual({
      mode: 'dark',
      themeMode: 'dark',
      palette: 'blue',
      videoAnalysisFiltersExpanded: false,
    });
  });

  it('stores a built-in palette name without dropping the other settings', () => {
    const initialState = {
      mode: 'light',
      palette: 'blue',
      videoAnalysisFiltersExpanded: true,
    } satisfies AppSettings;

    expect(settingsReducer(initialState, {type: 'SET_PALETTE', palette: 'green'})).toEqual({
      mode: 'light',
      palette: 'green',
      videoAnalysisFiltersExpanded: true,
    });
  });

  it('stores a custom colour picked from the wheel without dropping the other settings', () => {
    const initialState = {
      mode: 'light',
      palette: 'blue',
      videoAnalysisFiltersExpanded: true,
    } satisfies AppSettings;

    expect(settingsReducer(initialState, {type: 'SET_PALETTE', palette: '#E91E63'})).toEqual({
      mode: 'light',
      palette: '#E91E63',
      customPalette: '#E91E63',
      videoAnalysisFiltersExpanded: true,
    });
  });

  it('remembers the picked colour when a built-in palette is applied afterwards (GH-478)', () => {
    const custom = settingsReducer({mode: 'dark', palette: 'blue'} as AppSettings, {type: 'SET_PALETTE', palette: '#e91e63'});
    const blue = settingsReducer(custom, {type: 'SET_PALETTE', palette: 'purple'});

    expect(blue.palette).toEqual('purple');
    expect(blue.customPalette).toEqual('#E91E63');
  });

  it("leaves an existing user's palette untouched for unrelated actions", () => {
    const existingUser = {
      mode: 'light',
      palette: 'green',
      videoAnalysisFiltersExpanded: false,
    } satisfies AppSettings;

    expect(settingsReducer(existingUser, {type: 'TOGGLE_MODE'})).toEqual({
      mode: 'dark',
      themeMode: 'dark',
      palette: 'green',
      videoAnalysisFiltersExpanded: false,
    });
  });

  it('persists the video analysis filter expansion state', () => {
    const initialState = {
      mode: 'dark',
      palette: 'blue',
      videoAnalysisFiltersExpanded: false,
    } satisfies AppSettings;

    expect(settingsReducer(initialState, {type: 'SET_VIDEO_ANALYSIS_FILTERS_EXPANDED', expanded: true})).toEqual({
      mode: 'dark',
      palette: 'blue',
      videoAnalysisFiltersExpanded: true,
    });
  });

  describe('muscle map compare persistence (GH-300)', () => {
    it('stores the Plan-View compare selection without touching the Analyse selection', () => {
      const initial = {
        mode: 'dark',
        muscleMapCompareSelectionPlan: 'current_total_plan',
        muscleMapCompareSelectionAnalyse: 'last_training_done',
      } as AppSettings;

      const next = settingsReducer(initial, {type: 'SET_PLAN_MUSCLE_MAP_COMPARE', compare: 'last_training_plan'});

      expect(next.muscleMapCompareSelectionPlan).toBe('last_training_plan');
      expect(next.muscleMapCompareSelectionAnalyse).toBe('last_training_done');
    });

    it('stores the Analyse-View compare selection without touching the Plan selection', () => {
      const initial = {
        mode: 'dark',
        muscleMapCompareSelectionPlan: 'current_total_plan',
        muscleMapCompareSelectionAnalyse: 'last_training_done',
      } as AppSettings;

      const next = settingsReducer(initial, {type: 'SET_ANALYSE_MUSCLE_MAP_COMPARE', compare: 'last_training_plan'});

      expect(next.muscleMapCompareSelectionAnalyse).toBe('last_training_plan');
      expect(next.muscleMapCompareSelectionPlan).toBe('current_total_plan');
    });

    it('mirrors Plan-View selection into the legacy plan.muscleMap.compare slot for compat', () => {
      const initial = {mode: 'dark'} as AppSettings;
      const next = settingsReducer(initial, {type: 'SET_PLAN_MUSCLE_MAP_COMPARE', compare: 'last_training_plan'});
      expect(next.plan?.muscleMap?.compare).toBe('last_training_plan');
    });
  });
});
