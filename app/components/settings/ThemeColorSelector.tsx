import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, SegmentedButtons, useTheme} from 'react-native-paper';
import {useSettings} from '../../redux/settings/use/useSettings';
import {useThemeMode} from '../../redux/settings/use/useThemeMode';
import {dispatchSetPalette} from '../../redux/settings/dispatch/dispatchSetPalette';
import {customChoicePalette, customPaletteHex, paletteLabel, PaletteSelection, themeColorChoice} from '../../theme/palette';
import {palettePreviewColors, THEME_COLOR_CHOICE_OPTIONS} from '../../theme/palettePreview';
import {normalizeHex} from '../../theme/colorScience';
import PaletteSwatch from './PaletteSwatch';
import SettingsSegmentRow from './SettingsSegmentRow';
import ThemeColorPickerDialog from './ThemeColorPickerDialog';

/**
 * The "Custom Color" settings row: Blue / Purple / Custom as the app's standard
 * segmented buttons, each previewing its colours.
 *
 * Blue and Purple apply their palette with one tap. Custom opens the colour
 * wheel and previews the custom colour — the active one, or the one picked
 * last while a built-in palette is on.
 */
const ThemeColorSelector = () => {
  const theme = useTheme();
  const settings = useSettings();
  const {scheme} = useThemeMode();
  const setPalette = dispatchSetPalette();
  const [pickerVisible, setPickerVisible] = useState(false);

  const choice = themeColorChoice(settings.palette);
  const customPalette = customChoicePalette(settings.palette, settings.customPalette);
  // The wheel opens on the picked custom colour, or on the current primary
  // when there is none (yet, or the retired Green preset is active).
  const pickerStartColor =
    customPaletteHex(customPalette ?? undefined) ?? normalizeHex(theme.colors.primary) ?? '#0061A4';

  const previewOf = (palette: PaletteSelection | null, testID: string) => {
    if (!palette) {
      return ({size, color}: {size: number; color: string}) => (
        <View style={styles.preview} testID={`${testID}-preview`}>
          <Icon source="palette-outline" size={size} color={color} />
        </View>
      );
    }
    const colors = palettePreviewColors(palette, scheme);
    return ({size}: {size: number}) => (
      <View style={styles.preview}>
        <PaletteSwatch colors={colors} size={size} testID={`${testID}-preview`} />
      </View>
    );
  };

  const buttons = THEME_COLOR_CHOICE_OPTIONS.map((option) => {
    const palette = option.value === 'custom' ? customPalette : option.value;
    return {
      value: option.value,
      label: option.label,
      testID: option.testID,
      // Names the colour too, so a screen reader (and the e2e flow) can tell
      // which custom colour the segment holds.
      accessibilityLabel: option.value === 'custom' && palette ? `Custom ${paletteLabel(palette)}` : option.label,
      icon: previewOf(palette, option.testID),
      labelStyle: styles.label,
    };
  });

  return (
    <SettingsSegmentRow label="Custom Color" testID="settings-theme-palette-row">
      <SegmentedButtons
        value={choice}
        onValueChange={(value: string) => {
          if (value === 'custom') {
            setPickerVisible(true);
          } else {
            setPalette(value);
          }
        }}
        buttons={buttons}
      />
      <ThemeColorPickerDialog
        visible={pickerVisible}
        initialColor={pickerStartColor}
        onDismiss={() => setPickerVisible(false)}
        onConfirm={(hex) => {
          setPalette(hex);
          setPickerVisible(false);
        }}
      />
    </SettingsSegmentRow>
  );
};

const styles = StyleSheet.create({
  // Paper pads every segment by 16 on each side, which leaves "Purple" and
  // "Custom" next to their swatch too little room in a third of the row.
  // Swatch and label may run halfway into that padding instead of being cut off.
  preview: {
    marginLeft: -8,
  },
  label: {
    marginRight: -8,
  },
});

export default ThemeColorSelector;
