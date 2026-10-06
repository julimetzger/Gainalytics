/**
 * GH-404: the Theme settings row.
 *
 * These specs drive the real `react-native-paper` control rather than a stub —
 * the a11y state and the per-item testIDs only exist because Paper's
 * ToggleButton emits them, so a hand-rolled replacement would fail here.
 */
import React from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import {MD3DarkTheme, MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import ThemeModeSelector from '../../../app/components/settings/ThemeModeSelector';
import {useSettings} from '../../../app/redux/settings/use/useSettings';
import {dispatchSetThemeMode} from '../../../app/redux/settings/dispatch/dispatchSetThemeMode';

const mockSetThemeMode = jest.fn();

jest.mock('../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetThemeMode', () => ({
  dispatchSetThemeMode: jest.fn(() => mockSetThemeMode),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const mockedUseSettings = jest.mocked(useSettings);
const mockedUseColorScheme = jest.mocked(useColorScheme);

const renderSelector = (theme: typeof MD3LightTheme = MD3LightTheme) =>
  render(
    <PaperProvider theme={theme}>
      <ThemeModeSelector />
    </PaperProvider>,
  );

describe('ThemeModeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dispatchSetThemeMode).mockReturnValue(mockSetThemeMode);
    mockedUseColorScheme.mockReturnValue('light');
    mockedUseSettings.mockReturnValue({mode: 'dark', themeMode: 'dark', palette: 'blue'});
  });

  it('offers System, Light and Dark as a labelled icon group', () => {
    renderSelector();

    expect(screen.getByText('Mode')).toBeTruthy();
    expect(screen.getByTestId('settings-theme-mode-system')).toBeTruthy();
    expect(screen.getByTestId('settings-theme-mode-light')).toBeTruthy();
    expect(screen.getByTestId('settings-theme-mode-dark')).toBeTruthy();
  });

  it('marks the stored mode as the selected one', () => {
    mockedUseSettings.mockReturnValue({mode: 'light', themeMode: 'light', palette: 'blue'});
    renderSelector();

    expect(screen.getByTestId('settings-theme-mode-light').props.accessibilityState).toEqual({
      busy: undefined,
      checked: undefined,
      disabled: false,
      expanded: undefined,
      selected: true,
    });
    expect(screen.getByTestId('settings-theme-mode-dark').props.accessibilityState).toEqual({
      busy: undefined,
      checked: undefined,
      disabled: false,
      expanded: undefined,
      selected: false,
    });
  });

  it('switches the mode on a single tap', () => {
    renderSelector();

    fireEvent.press(screen.getByTestId('settings-theme-mode-system'));

    expect(mockSetThemeMode).toHaveBeenCalledWith('system');
  });

  it('keeps a mode set when its own button is pressed again', () => {
    // Paper reports `null` for a press on the active button; a theme always has
    // to be set, so that must not clear the selection.
    mockedUseSettings.mockReturnValue({mode: 'light', themeMode: 'light', palette: 'blue'});
    renderSelector();

    fireEvent.press(screen.getByTestId('settings-theme-mode-light'));

    expect(mockSetThemeMode).not.toHaveBeenCalled();
  });

  it('explains an icon on a long press', () => {
    renderSelector();

    expect(screen.queryByText(/follows your device display setting/)).toBeNull();

    act(() => {
      fireEvent(screen.getByTestId('settings-theme-mode-system'), 'longPress');
    });

    expect(
      screen.getByText('System: follows your device display setting and switches with it.'),
    ).toBeTruthy();
  });

  it('explains each icon with its own text', () => {
    renderSelector();

    act(() => {
      fireEvent(screen.getByTestId('settings-theme-mode-dark'), 'longPress');
    });

    expect(
      screen.getByText('Dark: always use the dark colours, whatever the device is set to.'),
    ).toBeTruthy();
  });

  it('keeps the help up until it is dismissed', () => {
    renderSelector();

    act(() => {
      fireEvent(screen.getByTestId('settings-theme-mode-system'), 'longPress');
    });
    expect(screen.getByText(/follows your device display setting/)).toBeTruthy();

    fireEvent.press(screen.getByText('Got it'));

    expect(screen.queryByText(/follows your device display setting/)).toBeNull();
  });

  it('closes the help when a mode is picked', () => {
    renderSelector();

    act(() => {
      fireEvent(screen.getByTestId('settings-theme-mode-system'), 'longPress');
    });
    expect(screen.getByText(/follows your device display setting/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('settings-theme-mode-light'));

    expect(screen.queryByText(/follows your device display setting/)).toBeNull();
    expect(mockSetThemeMode).toHaveBeenCalledWith('light');
  });

  it('reports the scheme actually in effect for an explicit choice', () => {
    mockedUseSettings.mockReturnValue({mode: 'light', themeMode: 'light', palette: 'blue'});
    mockedUseColorScheme.mockReturnValue('dark');
    renderSelector();

    expect(screen.getByTestId('settings-theme-active-mode').props.children).toEqual('Active: Light');
  });

  it('follows the device while System is selected, and updates when the device changes', () => {
    mockedUseSettings.mockReturnValue({mode: 'dark', themeMode: 'system', palette: 'blue'});
    mockedUseColorScheme.mockReturnValue('dark');
    renderSelector();

    expect(screen.getByTestId('settings-theme-active-mode').props.children).toEqual(
      'Active: Dark, following system',
    );

    mockedUseColorScheme.mockReturnValue('light');
    screen.rerender(
      <PaperProvider theme={MD3LightTheme}>
        <ThemeModeSelector />
      </PaperProvider>,
    );

    expect(screen.getByTestId('settings-theme-active-mode').props.children).toEqual(
      'Active: Light, following system',
    );
  });

  it('draws one pill: rounded outer ends, square inner joins, accent fill on the selection', () => {
    // GH-462: the three icons form a single segmented control.
    mockedUseSettings.mockReturnValue({mode: 'light', themeMode: 'system', palette: 'blue'});
    renderSelector();

    const styleOf = (testID: string) => {
      let node: {props: {style?: unknown}; parent: unknown} | null = screen.getByTestId(testID);
      while (node) {
        const style = StyleSheet.flatten(node.props.style);
        if (style?.backgroundColor !== undefined) return style;
        node = node.parent as typeof node;
      }
      return undefined;
    };
    const shape = (testID: string) => {
      const style = styleOf(testID);
      return {
        backgroundColor: style?.backgroundColor,
        borderTopLeftRadius: style?.borderTopLeftRadius,
        borderTopRightRadius: style?.borderTopRightRadius,
      };
    };

    expect([shape('settings-theme-mode-system'), shape('settings-theme-mode-light'), shape('settings-theme-mode-dark')]).toEqual([
      {backgroundColor: MD3LightTheme.colors.secondaryContainer, borderTopLeftRadius: 20, borderTopRightRadius: 0},
      {backgroundColor: 'transparent', borderTopLeftRadius: undefined, borderTopRightRadius: undefined},
      {backgroundColor: 'transparent', borderTopLeftRadius: 0, borderTopRightRadius: 20},
    ]);
  });

  it('takes the caption colour from the theme rather than a literal', () => {
    // Rendering against both schemes is what makes this fail for a hardcoded
    // value: a literal cannot match two different tokens at once.
    const light = renderSelector(MD3LightTheme);
    const lightColor = flattenColor(light.getByTestId('settings-theme-active-mode'));
    light.unmount();

    const dark = renderSelector(MD3DarkTheme);
    const darkColor = flattenColor(dark.getByTestId('settings-theme-active-mode'));

    expect(lightColor).toEqual(MD3LightTheme.colors.onSurfaceVariant);
    expect(darkColor).toEqual(MD3DarkTheme.colors.onSurfaceVariant);
    expect(lightColor).not.toEqual(darkColor);
  });
});

const flattenColor = (node: {props: {style?: unknown}}): string | undefined => {
  const {StyleSheet} = require('react-native');
  return StyleSheet.flatten(node.props.style)?.color;
};
