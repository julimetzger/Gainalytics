import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTheme} from 'react-native-paper';

interface Props {
  color: string;
  size: number;
  testID?: string;
}

/**
 * A small round preview of a palette, filled with its primary colour only
 * (GH-522).
 */
const PaletteSwatch = ({color, size, testID}: Props) => {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.circle,
        {width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.outline, backgroundColor: color},
      ]}
    />
  );
};

const styles = StyleSheet.create({
  circle: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default memo(PaletteSwatch);
