import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';

describe('settingsReducer', () => {
  it('defaults video analysis filters to collapsed', () => {
    expect(settingsReducer(undefined, {type: '@@INIT'})).toEqual({
      mode: 'dark',
      palette: 'blue',
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
});
