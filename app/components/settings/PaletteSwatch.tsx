import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import type {PalettePreviewColors} from '../../theme/palettePreview';

interface Props {
  colors: PalettePreviewColors;
  size: number;
  testID?: string;
}

/**
 * A small round preview of a palette: primary on top, secondary and tertiary
 * side by side below — the same split Android uses for its wallpaper colours.
 */
const PaletteSwatch = ({colors, size, testID}: Props) => {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.circle,
        {width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.outline},
      ]}
    >
      <View style={[styles.half, {backgroundColor: colors.primary}]} />
      <View style={[styles.half, styles.bottom]}>
        <View style={[styles.quarter, {backgroundColor: colors.secondary}]} />
        <View style={[styles.quarter, {backgroundColor: colors.tertiary}]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  half: {
    flex: 1,
  },
  bottom: {
    flexDirection: 'row',
  },
  quarter: {
    flex: 1,
  },
});

export default memo(PaletteSwatch);
