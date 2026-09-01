import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

interface SegmentedButtonMock {
  value: string;
  label: string;
  testID?: string;
  accessibilityLabel?: string;
}

interface SegmentedButtonsMockProps {
  value: string;
  onValueChange: (value: string) => void;
  buttons: SegmentedButtonMock[];
}

/**
 * Stand-in for Paper's SegmentedButtons for the specs that mock the whole
 * library away. It mirrors the parts a test can observe on the real
 * SegmentedButtonItem: the item's testID lands on the touchable, the label gets
 * `${testID}-label`, and the a11y state is `{disabled, checked}` — not
 * `{selected}`. Keep it in sync with react-native-paper's SegmentedButtonItem.
 */
export const SegmentedButtonsMock = ({value, onValueChange, buttons}: SegmentedButtonsMockProps) => (
  <View>
    {buttons.map((button) => (
      <TouchableOpacity
        key={button.value}
        testID={button.testID}
        accessibilityRole="button"
        accessibilityLabel={button.accessibilityLabel}
        accessibilityState={{disabled: false, checked: button.value === value}}
        onPress={() => onValueChange(button.value)}
      >
        <Text testID={button.testID ? `${button.testID}-label` : undefined}>{button.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);
