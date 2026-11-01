import {useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {buildThemes} from '../../../theme/buildThemes';
import {resolveColorScheme, resolveThemeModeSetting} from '../../../theme/themeMode';

/**
 * GH-674: the theme the app root hands to Paper and React Navigation.
 *
 * It reads only the three settings that decide the look and keeps the built
 * theme objects across renders. App used to subscribe to the whole settings
 * slice and call `buildThemes` on every render, so ANY settings change (opening
 * Settings stores the exact-alarm permission, every logged set the rest timer)
 * produced a new theme object and re-rendered every mounted screen. After a
 * round through all tabs that one re-render briefly needed ~110 MB of native
 * memory, which the allocator kept afterwards — the "jump at Settings".
 */
export const useAppTheme = () => {
  const palette = useSelector((state: GlobalState) => state.settings?.palette);
  const themeMode = useSelector((state: GlobalState) => state.settings?.themeMode);
  const mode = useSelector((state: GlobalState) => state.settings?.mode);
  const systemScheme = useColorScheme();
  const scheme = resolveColorScheme(resolveThemeModeSetting({themeMode, mode}), systemScheme);
  const {DarkTheme, LightThemeCombined} = useMemo(() => buildThemes(palette), [palette]);

  return {scheme, theme: scheme === 'light' ? LightThemeCombined : DarkTheme};
};
