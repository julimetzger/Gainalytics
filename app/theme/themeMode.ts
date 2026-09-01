/**
 * The one place that decides which colour scheme the app renders in.
 *
 * Everything else — `App.tsx`, the settings row, the specs — reads the answer
 * from here instead of looking at `settings` again. Older installs only ever
 * persisted `settings.mode`, so `resolveThemeModeSetting` keeps honouring that
 * value: an existing "Enable Dark Mode" choice becomes an explicit Light/Dark
 * selection, never `system`.
 */
import type {ColorSchemeName} from 'react-native';

/** What the user picked in Settings. */
export type ThemeModeSetting = 'system' | 'light' | 'dark';

/** What the app actually renders in, after `system` has been resolved. */
export type ColorScheme = 'light' | 'dark';

export interface ThemeModeOption {
  value: ThemeModeSetting;
  /** MaterialCommunityIcons name, matching the icons in the ticket mockup. */
  icon: string;
  /** Spoken/short name — used for the accessibility label and the help text. */
  label: string;
  /** Shown on a long press so the icon-only control stays understandable. */
  help: string;
  testID: string;
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  {
    value: 'system',
    icon: 'brightness-auto',
    label: 'System',
    help: 'System: follows your device display setting and switches with it.',
    testID: 'settings-theme-mode-system',
  },
  {
    value: 'light',
    icon: 'white-balance-sunny',
    label: 'Light',
    help: 'Light: always use the light colours, whatever the device is set to.',
    testID: 'settings-theme-mode-light',
  },
  {
    value: 'dark',
    icon: 'weather-night',
    label: 'Dark',
    help: 'Dark: always use the dark colours, whatever the device is set to.',
    testID: 'settings-theme-mode-dark',
  },
];

export const themeModeOption = (value: ThemeModeSetting): ThemeModeOption =>
  THEME_MODE_OPTIONS.find((option) => option.value === value) ?? THEME_MODE_OPTIONS[0];

/** The subset of `AppSettings` this module needs — avoids a circular import. */
export interface ThemeModeSettingsSlice {
  themeMode?: ThemeModeSetting;
  mode?: 'light' | 'dark';
}

const isThemeModeSetting = (value: unknown): value is ThemeModeSetting =>
  value === 'system' || value === 'light' || value === 'dark';

/**
 * Reads the stored preference, falling back to the legacy `mode` flag.
 *
 * Installs from before GH-404 have no `themeMode`; their `mode` is carried over
 * verbatim so nobody is silently moved onto `system`.
 */
export const resolveThemeModeSetting = (settings?: ThemeModeSettingsSlice | null): ThemeModeSetting => {
  if (isThemeModeSetting(settings?.themeMode)) return settings!.themeMode!;
  if (settings?.mode === 'light' || settings?.mode === 'dark') return settings.mode;
  return 'dark';
};

/**
 * `system` follows the device. React Native reports `null` while the OS value
 * is still unknown — treat that as light, which is Android's own default.
 */
export const resolveColorScheme = (setting: ThemeModeSetting, systemScheme: ColorSchemeName): ColorScheme => {
  if (setting === 'light' || setting === 'dark') return setting;
  return systemScheme === 'dark' ? 'dark' : 'light';
};

/**
 * The caption under the selector. It is the only place in the UI that names the
 * scheme actually in effect, which is what makes "System" comprehensible — and
 * what an e2e flow asserts instead of merely checking that a button is visible.
 */
export const describeActiveScheme = (setting: ThemeModeSetting, scheme: ColorScheme): string => {
  const name = scheme === 'dark' ? 'Dark' : 'Light';
  return setting === 'system' ? `Active: ${name}, following system` : `Active: ${name}`;
};
