/**
 * GH-404 / GH-478: the Theme settings row.
 *
 * These specs drive the real `react-native-paper` controls rather than a stub —
 * the checked state, the per-segment testIDs and the tooltip only exist because
 * Paper's SegmentedButtons and Tooltip emit them, so a hand-rolled replacement
 * would fail here.
 */
import React from 'react';
import {useColorScheme} from 'react-native';
import {MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
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

const renderSelector = () =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <ThemeModeSelector />
    </PaperProvider>,
  );

/**
 * The Tooltip-wrapped touch target over a segment. It is hidden from
 * accessibility on purpose (screen readers use Paper's segment underneath), so
 * the query has to opt into hidden elements.
 */
const touchTarget = (testID: string) => screen.getByTestId(testID, {includeHiddenElements: true});

const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState.checked;

describe('ThemeModeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.mocked(dispatchSetThemeMode).mockReturnValue(mockSetThemeMode);
    jest.mocked(useColorScheme).mockReturnValue('light');
    mockedUseSettings.mockReturnValue({mode: 'dark', themeMode: 'dark', palette: 'blue'});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('labels the row "Theme" and offers System, Light and Dark as icon segments', () => {
    renderSelector();

    expect(screen.getByTestId('settings-theme-mode-row-label').props.children).toEqual('Theme');
    for (const name of ['System', 'Light', 'Dark']) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    // Icon-only: no segment carries a text label.
    expect(screen.getByTestId('settings-theme-mode-light-label').props.children).toBeUndefined();
  });

  it('adds no explanatory caption to the row', () => {
    renderSelector();

    expect(screen.queryByText(/^Active:/)).toBeNull();
    expect(screen.queryByText('Mode')).toBeNull();
  });

  it('marks the stored mode as the checked segment', () => {
    mockedUseSettings.mockReturnValue({mode: 'light', themeMode: 'light', palette: 'blue'});
    renderSelector();

    expect(['system', 'light', 'dark'].map((mode) => checked(`settings-theme-mode-${mode}`))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('falls back to the legacy mode flag for a pre-GH-404 store', () => {
    mockedUseSettings.mockReturnValue({mode: 'light', palette: 'blue'});
    renderSelector();

    expect(checked('settings-theme-mode-light')).toBe(true);
  });

  it('switches the mode on a single tap of the segment', () => {
    renderSelector();

    fireEvent.press(touchTarget('settings-theme-mode-system-touch'));

    expect(mockSetThemeMode).toHaveBeenCalledWith('system');
  });

  it("names a segment in Paper's Tooltip on a long press, without switching", () => {
    renderSelector();
    expect(screen.queryByText('Light: always light')).toBeNull();

    act(() => {
      fireEvent(touchTarget('settings-theme-mode-light-touch'), 'longPress');
    });

    expect(screen.getByText('Light: always light')).toBeTruthy();
    expect(screen.getByTestId('tooltip-container')).toBeTruthy();
    expect(mockSetThemeMode).not.toHaveBeenCalled();

    // Released, the tooltip goes away on Paper's own timer.
    act(() => {
      fireEvent(touchTarget('settings-theme-mode-light-touch'), 'pressOut');
      jest.runAllTimers();
    });
    expect(screen.queryByText('Light: always light')).toBeNull();
  });

  it('gives each segment its own tooltip', () => {
    renderSelector();

    act(() => {
      fireEvent(touchTarget('settings-theme-mode-system-touch'), 'longPress');
    });

    expect(screen.getByText('System: follows your device')).toBeTruthy();
    expect(screen.queryByText('Dark: always dark')).toBeNull();
  });
});
