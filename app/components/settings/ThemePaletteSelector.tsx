import React, {useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, ToggleButton, useTheme} from 'react-native-paper';
import {useSettings} from '../../redux/settings/use/useSettings';
import {useThemeMode} from '../../redux/settings/use/useThemeMode';
import {dispatchSetPalette} from '../../redux/settings/dispatch/dispatchSetPalette';
import {customPaletteHex, paletteLabel} from '../../theme/palette';
import {PALETTE_PRESET_OPTIONS, palettePreviewColors} from '../../theme/palettePreview';
import PaletteSwatch from './PaletteSwatch';
import {pillSegmentStyle} from './pillSegmentStyle';

const SWATCH_SIZE = 22;

/**
 * The three built-in colour presets as a pill-shaped segmented control, in the
 * same visual language as the Theme mode row. Each segment previews its
 * palette's key colours; no segment is selected while a custom colour is
 * applied.
 */
const ThemePaletteSelector = () => {
  const theme = useTheme();
  const settings = useSettings();
  const {scheme} = useThemeMode();
  const setPalette = dispatchSetPalette();
  const palette = settings.palette ?? 'blue';
  const customHex = customPaletteHex(palette);

  const previews = useMemo(
    () => PALETTE_PRESET_OPTIONS.map((option) => palettePreviewColors(option.value, scheme)),
    [scheme],
  );

  const handleChange = useCallback(
    (value: string | null) => {
      // `null` means the already-selected preset was pressed again.
      if (value === null || value === undefined) return;
      setPalette(value);
    },
    [setPalette],
  );

  return (
    <View testID="settings-theme-palette-row">
      <View style={styles.row}>
        <Text style={styles.label}>Preset</Text>
        <ToggleButton.Row onValueChange={handleChange} value={palette}>
          {PALETTE_PRESET_OPTIONS.map((option, index) => {
            const selected = option.value === palette;
            return (
              <ToggleButton
                key={option.value}
                icon={() => (
                  <PaletteSwatch
                    colors={previews[index]}
                    size={SWATCH_SIZE}
                    testID={`${option.testID}-preview`}
                  />
                )}
                value={option.value}
                testID={option.testID}
                accessibilityLabel={`${option.label} palette`}
                style={pillSegmentStyle(theme, index, PALETTE_PRESET_OPTIONS.length, selected)}
              />
            );
          })}
        </ToggleButton.Row>
      </View>
      <Text
        variant="bodySmall"
        style={[styles.active, {color: theme.colors.onSurfaceVariant}]}
        testID="settings-theme-palette-active"
      >
        {customHex ? `Active: Custom ${customHex}` : `Active: ${paletteLabel(palette)}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  label: {
    alignSelf: 'center',
  },
  active: {
    marginBottom: 5,
  },
});

export default ThemePaletteSelector;
