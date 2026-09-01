import React, {useCallback, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Portal, Snackbar, Text, ToggleButton, useTheme} from 'react-native-paper';
import {useThemeMode} from '../../redux/settings/use/useThemeMode';
import {dispatchSetThemeMode} from '../../redux/settings/dispatch/dispatchSetThemeMode';
import {describeActiveScheme, THEME_MODE_OPTIONS, ThemeModeSetting} from '../../theme/themeMode';

/**
 * The "Theme" settings row: System / Light / Dark as an icon group.
 *
 * A tap switches the mode immediately — the store is the only state, so the
 * whole tree re-themes on the next render. Because the buttons carry icons and
 * no text, a long press explains what each one does.
 */
const ThemeModeSelector = () => {
  const theme = useTheme();
  const {setting, scheme} = useThemeMode();
  const setThemeMode = dispatchSetThemeMode();
  const [help, setHelp] = useState<string | null>(null);

  const handleChange = useCallback(
    (value: string | null) => {
      // ToggleButton.Row reports `null` when the already-selected button is
      // pressed again. A theme always has to be set, so ignore that.
      if (value === null || value === undefined) return;
      setThemeMode(value as ThemeModeSetting);
    },
    [setThemeMode],
  );

  return (
    <View testID="settings-theme-mode-row">
      <View style={styles.row}>
        <Text style={styles.label}>Theme</Text>
        <ToggleButton.Row onValueChange={handleChange} value={setting}>
          {THEME_MODE_OPTIONS.map((option) => {
            // ToggleButton forwards everything it does not destructure to
            // IconButton and on to TouchableRipple, but its published Props
            // type stops at the handful it names. Spreading keeps the working
            // `onLongPress` without casting the component away.
            const longPress = {onLongPress: () => setHelp(option.help)};

            return (
              <ToggleButton
                key={option.value}
                icon={option.icon}
                value={option.value}
                testID={option.testID}
                accessibilityLabel={option.label}
                {...longPress}
              />
            );
          })}
        </ToggleButton.Row>
      </View>
      <Text
        variant="bodySmall"
        style={[styles.activeMode, {color: theme.colors.onSurfaceVariant}]}
        testID="settings-theme-active-mode"
      >
        {describeActiveScheme(setting, scheme)}
      </Text>
      <Portal>
        <Snackbar
          visible={help !== null}
          onDismiss={() => setHelp(null)}
          duration={4000}
          testID="settings-theme-mode-help"
        >
          {help ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
    marginHorizontal: 15,
  },
  label: {
    alignSelf: 'center',
  },
  activeMode: {
    marginHorizontal: 15,
    marginBottom: 5,
  },
});

export default ThemeModeSelector;
