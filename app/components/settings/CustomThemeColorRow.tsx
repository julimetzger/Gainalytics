import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {useSettings} from '../../redux/settings/use/useSettings';
import {dispatchSetPalette} from '../../redux/settings/dispatch/dispatchSetPalette';
import {customPaletteHex, paletteLabel} from '../../theme/palette';
import {normalizeHex} from '../../theme/colorScience';
import ThemeColorPickerDialog from './ThemeColorPickerDialog';

/** The "Custom Color" row: a button showing the applied colour that opens the colour wheel. */
const CustomThemeColorRow = () => {
  const theme = useTheme();
  const settings = useSettings();
  const setPalette = dispatchSetPalette();
  const [pickerVisible, setPickerVisible] = useState(false);

  const currentCustomColor = customPaletteHex(settings.palette);
  // The wheel opens on the applied custom color, or on the current palette's
  // primary when one of the built-in palettes is active.
  const pickerStartColor = currentCustomColor ?? normalizeHex(theme.colors.primary) ?? '#0061A4';

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Pick any color</Text>
      <Button
        mode="outlined"
        testID="settings-custom-theme-color-button"
        // Also the value a screen reader (and the Maestro flow) reads back.
        accessibilityLabel={`Theme colour ${paletteLabel(settings.palette)}`}
        onPress={() => setPickerVisible(true)}
        icon={() => (
          <View
            style={[styles.swatch, {backgroundColor: theme.colors.primary, borderColor: theme.colors.outline}]}
          />
        )}
      >
        {paletteLabel(settings.palette)}
      </Button>
      <ThemeColorPickerDialog
        visible={pickerVisible}
        initialColor={pickerStartColor}
        onDismiss={() => setPickerVisible(false)}
        onConfirm={(hex) => {
          setPalette(hex);
          setPickerVisible(false);
        }}
      />
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
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
});

export default CustomThemeColorRow;
