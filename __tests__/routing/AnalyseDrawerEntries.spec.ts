import {ANALYSE_DRAWER_HIDDEN_ROUTES, getAnalyseDrawerItemOptions, getAnalyseHeaderTitleStyle} from '../../app/routing/AnalyseRouter';
import {MD3DarkTheme, MD3LightTheme} from 'react-native-paper';

/**
 * GH-458 (H1/H2): "Video Analysis Detail" and "Compare Analyses" were reachable
 * as standalone drawer entries. Opened that way they had no selection to show —
 * Detail crashed into a white screen, Compare into a dead end. Both are detail
 * screens of the Video Analysis list, so the drawer must not offer them while
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

/**
 * GH-484: the drawer header read `fonts.medium`, which the Paper MD3 theme does
 * not define, so the Analyse titles (Dashboard first) were set in regular weight
 * next to the medium titles of Training, Exercises and Settings.
 */
describe('Analyse header title font (GH-484)', () => {
  it.each([
    ['light', MD3LightTheme],
    ['dark', MD3DarkTheme],
  ])('uses the medium title face in the %s theme', (_name, theme) => {
    expect(getAnalyseHeaderTitleStyle(theme.fonts)).toEqual({
      fontFamily: theme.fonts.titleMedium.fontFamily,
      fontWeight: '500',
    });
  });
});
