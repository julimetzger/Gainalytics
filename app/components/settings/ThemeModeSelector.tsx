import React, {useMemo} from 'react';
import {useThemeMode} from '../../redux/settings/use/useThemeMode';
import {dispatchSetThemeMode} from '../../redux/settings/dispatch/dispatchSetThemeMode';
import {THEME_MODE_OPTIONS, ThemeModeSetting} from '../../theme/themeMode';
import TooltipSegmentedButtons from '../common/TooltipSegmentedButtons';
import SettingsSegmentRow from './SettingsSegmentRow';

/**
 * The "Theme" settings row: System / Light / Dark as the app's standard
 * segmented buttons, icon-only, across the full row width.
 *
 * A tap switches the mode immediately — the store is the only state, so the
 * whole tree re-themes on the next render. A long press names what an icon
 * does, in the same Tooltip as the rest of the app.
 */
const ThemeModeSelector = () => {
  const {setting} = useThemeMode();
  const setThemeMode = dispatchSetThemeMode();

  const buttons = useMemo(
    () =>
      THEME_MODE_OPTIONS.map((option) => ({
        value: option.value,
        icon: option.icon,
        accessibilityLabel: option.label,
        testID: option.testID,
        tooltip: option.help,
      })),
    [],
  );

  return (
    <SettingsSegmentRow label="Theme" testID="settings-theme-mode-row">
      <TooltipSegmentedButtons
        value={setting}
        onValueChange={(value) => setThemeMode(value as ThemeModeSetting)}
        buttons={buttons}
      />
    </SettingsSegmentRow>
  );
};

export default ThemeModeSelector;
