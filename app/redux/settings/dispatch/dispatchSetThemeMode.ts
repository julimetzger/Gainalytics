import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {ThemeModeSetting} from '../../../theme/themeMode';

export const dispatchSetThemeMode = () => {
  const dispatch = useDispatch();

  return (themeMode: ThemeModeSetting) =>
    dispatch({
      type: 'SET_THEME_MODE',
      themeMode,
    } as Action & {themeMode: ThemeModeSetting});
};
