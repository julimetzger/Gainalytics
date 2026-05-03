import React from 'react';
import {StyleSheet, ViewStyle} from 'react-native';
import {Button, useTheme} from 'react-native-paper';

interface DashedAddButtonProps {
  label: string;
  onPress: () => void;
  testID?: string;
  style?: ViewStyle;
}

const DashedAddButton = ({label, onPress, testID, style}: DashedAddButtonProps) => {
  const theme = useTheme();

  return (
    <Button
      mode="outlined"
      compact
      testID={testID}
      onPress={onPress}
      style={[
        styles.button,
        {
          borderColor: theme.colors.outline,
        },
        style,
      ]}
      labelStyle={[
        styles.label,
        {
          color: theme.colors.onSurfaceVariant,
        },
      ]}
    >
      {label}
    </Button>
  );
};

const styles = StyleSheet.create({
  button: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DashedAddButton;
