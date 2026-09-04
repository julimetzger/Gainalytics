import {useColorScheme} from 'react-native';
import {useSettings} from './useSettings';
import {ColorScheme, resolveColorScheme, resolveThemeModeSetting, ThemeModeSetting} from '../../../theme/themeMode';

export interface ThemeModeState {
  /** What the user picked: system, light or dark. */
  setting: ThemeModeSetting;
  /** What the app renders in right now — `system` already resolved. */
  scheme: ColorScheme;
}

/**
 * The single hook every consumer uses to learn the current colour scheme.
 *
 * `useColorScheme` re-renders on an Appearance change, so a device switching to
 * dark mode while the app is open flips the theme without a restart.
 */
export const useThemeMode = (): ThemeModeState => {
  const settings = useSettings();
  const systemScheme = useColorScheme();
  const setting = resolveThemeModeSetting(settings);

  return {setting, scheme: resolveColorScheme(setting, systemScheme)};
};
