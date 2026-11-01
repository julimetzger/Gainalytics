import {useColorScheme} from 'react-native';
import {useSettingsSelector} from './useSettings';
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
  // GH-671: only the two theme fields — App.tsx sits on this hook, and a whole-settings
  // subscription re-rendered the app root on every rest-timer start.
  const themeMode = useSettingsSelector((settings) => settings.themeMode);
  const mode = useSettingsSelector((settings) => settings.mode);
  const systemScheme = useColorScheme();
  const setting = resolveThemeModeSetting({themeMode, mode});

  return {setting, scheme: resolveColorScheme(setting, systemScheme)};
};
