import {useMemo} from 'react';
import {buildThemes} from '../../../theme/buildThemes';
import {useSettingsSelector} from './useSettings';
import {useThemeMode} from './useThemeMode';

/**
 * GH-674: the theme the app root hands to Paper and React Navigation.
 *
 * It reads only the settings that decide the look (palette here, theme mode via `useThemeMode`)
 * and keeps the built theme objects across renders. App used to subscribe to the whole settings
 * slice and call `buildThemes` on every render, so ANY settings change (opening Settings stores
 * the exact-alarm permission, every logged set the rest timer) produced a new theme object and
 * re-rendered every mounted screen. After a round through all tabs that one re-render briefly
 * needed ~110 MB of native memory, which the allocator kept afterwards — the "jump at Settings".
 */
export const useAppTheme = () => {
  const palette = useSettingsSelector((settings) => settings?.palette);
  const {scheme} = useThemeMode();
  const {DarkTheme, LightThemeCombined} = useMemo(() => buildThemes(palette), [palette]);

  return {scheme, theme: scheme === 'light' ? LightThemeCombined : DarkTheme};
};
