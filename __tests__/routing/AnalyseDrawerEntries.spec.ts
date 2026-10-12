import {
  ANALYSE_DRAWER_HIDDEN_ROUTES,
  getAnalyseDrawerItemOptions,
  getAnalyseDrawerLayoutOptions,
  getAnalyseHeaderTitleStyle,
} from '../../app/routing/AnalyseRouter';
import {MD3DarkTheme, MD3LightTheme} from 'react-native-paper';
import {getDefaultHeaderHeight} from '@react-navigation/elements';
import {Platform} from 'react-native';

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

/**
 * GH-420: the drawer spanned the full screen height and covered the header, so
 * the menu icon sat underneath the drawer's first entry — tapping it to close
 * the drawer selected "Dashboard" instead. The drawer must start exactly where
 * the drawer navigator's header ends, leaving the menu icon under the overlay.
 */
describe('Analyse drawer starts below the header (GH-420)', () => {
  // The app ships on Android only; jest's react-native preset defaults to iOS,
  // whose header is shorter.
  const originalOS = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = originalOS;
  });

  it.each([0, 24, 28, 48])('aligns the drawer top with the header bottom for a %i dp status bar', (topInset) => {
    const portrait = {width: 360, height: 800};
    expect(getAnalyseDrawerLayoutOptions(topInset).drawerStyle.top).toBe(getDefaultHeaderHeight(portrait, false, topInset));
  });

  it('drops the status-bar padding from the drawer list', () => {
    expect(getAnalyseDrawerLayoutOptions(28).drawerContentContainerStyle).toEqual({paddingTop: 12});
  });
});
