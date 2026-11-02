/**
 * GH-674: the app root's theme must keep its identity across settings changes that do not
 * touch the look. A new theme object re-renders every mounted screen; after a round through
 * all tabs that re-render was the ~110 MB native memory jump when opening Settings.
 */
import React from 'react';
import {act, renderHook} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import rootReducer from '../../../app/redux/rootReducer';
import {AppSettings} from '../../../app/redux/settings/settingsReducer';
import {useAppTheme} from '../../../app/redux/settings/use/useAppTheme';
import {buildThemes} from '../../../app/theme/buildThemes';

// jest.setup.js stubs useSelector globally to return [] — this suite drives a real store.
jest.mock('react-redux', () => jest.requireActual('react-redux'));

const renderAppTheme = () => {
  const store = configureStore({reducer: rootReducer});
  store.dispatch({type: 'SET_THEME_MODE', themeMode: 'dark'});
  store.dispatch({type: 'SET_PALETTE', palette: 'blue'});
  const wrapper = ({children}: {children: React.ReactNode}) => <Provider store={store}>{children}</Provider>;
  return {store, ...renderHook(() => useAppTheme(), {wrapper})};
};

describe('useAppTheme (GH-674)', () => {
  it('renders the dark theme of the stored palette', () => {
    const {result} = renderAppTheme();

    expect(result.current).toEqual({scheme: 'dark', theme: buildThemes('blue').DarkTheme});
  });

  it('keeps the same theme object when settings change that do not affect the look', () => {
    const {store, result} = renderAppTheme();
    const before = result.current.theme;

    act(() => {
      store.dispatch({type: 'SET_EXACT_ALARM_PERMISSION', hasPermission: false});
      store.dispatch({type: 'SET_EXACT_ALARM_PERMISSION', hasPermission: true});
      store.dispatch({type: 'TOGGLE_DISABLE_TOASTS'});
      store.dispatch({type: 'SET_ANTHROPIC_MODEL', model: 'claude-test'});
    });

    expect(store.getState().settings).toEqual({
      mode: 'dark',
      themeMode: 'dark',
      palette: 'blue',
      videoAnalysisFiltersExpanded: false,
      localNotification: {exactAlarmPermission: true},
      toggles: {disableToasts: true},
      anthropicModel: 'claude-test',
    } satisfies AppSettings);
    expect(result.current.theme).toBe(before);
  });

  it('switches to a new theme when the palette or the theme mode changes', () => {
    const {store, result} = renderAppTheme();

    act(() => {
      store.dispatch({type: 'SET_PALETTE', palette: 'green'});
    });
    expect(result.current).toEqual({scheme: 'dark', theme: buildThemes('green').DarkTheme});

    act(() => {
      store.dispatch({type: 'SET_THEME_MODE', themeMode: 'light'});
    });
    expect(result.current).toEqual({scheme: 'light', theme: buildThemes('green').LightThemeCombined});
  });
});
