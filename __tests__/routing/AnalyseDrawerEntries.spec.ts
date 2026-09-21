import {ANALYSE_DRAWER_HIDDEN_ROUTES, getAnalyseDrawerItemOptions} from '../../app/routing/AnalyseRouter';

/**
 * GH-458 (H1/H2): "Video Analysis Detail" and "Compare Analyses" were reachable
 * as standalone drawer entries. Opened that way they had no selection to show —
 * Detail crashed into a white screen, Compare into a dead end. Both are detail
 * screens of the Video Analyses list, so the drawer must not offer them while
 * the routes themselves stay registered for the list to navigate to.
 */
describe('Analyse drawer entries (GH-458 H1/H2)', () => {
  it('hides exactly the two selection-dependent detail routes', () => {
    expect(ANALYSE_DRAWER_HIDDEN_ROUTES).toEqual(['VideoAnalysisDetail', 'VideoAnalysisCompare']);
  });

  it.each(ANALYSE_DRAWER_HIDDEN_ROUTES)('gives %s a hidden drawer item', (routeName) => {
    expect(getAnalyseDrawerItemOptions(routeName)).toEqual({drawerItemStyle: {display: 'none'}});
  });

  it.each(['Dashboard', 'AnalyseHome', 'TrainingLength', 'History', 'Metrics', 'Records', 'VideoAnalyses', 'AIChat', 'ChatHistory'] as const)(
    'keeps %s listed in the drawer',
    (routeName) => {
      expect(getAnalyseDrawerItemOptions(routeName)).toEqual({});
    },
  );
});
