import {
  describeActiveScheme,
  resolveColorScheme,
  resolveThemeModeSetting,
  THEME_MODE_OPTIONS,
  themeModeOption,
} from '../../app/theme/themeMode';

describe('resolveThemeModeSetting', () => {
  it('uses the explicit selection when one is stored', () => {
    expect(resolveThemeModeSetting({themeMode: 'system', mode: 'dark'})).toEqual('system');
    expect(resolveThemeModeSetting({themeMode: 'light', mode: 'dark'})).toEqual('light');
    expect(resolveThemeModeSetting({themeMode: 'dark', mode: 'light'})).toEqual('dark');
  });

  it('carries a pre-GH-404 install over to the matching explicit mode', () => {
    // The old settings row was a single "Enable Dark Mode" switch, so these two
    // shapes are exactly what an existing user's store looks like.
    expect(resolveThemeModeSetting({mode: 'light'})).toEqual('light');
    expect(resolveThemeModeSetting({mode: 'dark'})).toEqual('dark');
  });

  it('never moves an existing choice onto system', () => {
    expect(resolveThemeModeSetting({mode: 'light'})).not.toEqual('system');
    expect(resolveThemeModeSetting({mode: 'dark'})).not.toEqual('system');
  });

  it('falls back to the app default when nothing is stored at all', () => {
    expect(resolveThemeModeSetting(undefined)).toEqual('dark');
    expect(resolveThemeModeSetting(null)).toEqual('dark');
    expect(resolveThemeModeSetting({})).toEqual('dark');
  });
});

describe('resolveColorScheme', () => {
  it('ignores the device for an explicit choice', () => {
    expect(resolveColorScheme('light', 'dark')).toEqual('light');
    expect(resolveColorScheme('dark', 'light')).toEqual('dark');
  });

  it('follows the device while system is selected', () => {
    expect(resolveColorScheme('system', 'dark')).toEqual('dark');
    expect(resolveColorScheme('system', 'light')).toEqual('light');
  });

  it('treats an unknown device setting as light', () => {
    expect(resolveColorScheme('system', null)).toEqual('light');
  });
});

describe('describeActiveScheme', () => {
  it('names the scheme actually in effect, and says when it came from the device', () => {
    expect(describeActiveScheme('system', 'dark')).toEqual('Active: Dark, following system');
    expect(describeActiveScheme('system', 'light')).toEqual('Active: Light, following system');
    expect(describeActiveScheme('light', 'light')).toEqual('Active: Light');
    expect(describeActiveScheme('dark', 'dark')).toEqual('Active: Dark');
  });
});

describe('THEME_MODE_OPTIONS', () => {
  it('offers system, light and dark, each with an icon and a help text', () => {
    expect(THEME_MODE_OPTIONS).toEqual([
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
    ]);
  });

  it('looks an option up by value', () => {
    expect(themeModeOption('light')).toEqual(THEME_MODE_OPTIONS[1]);
  });
});
