import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';

interface Props {
  label: string;
  testID: string;
  children: React.ReactNode;
}

/**
 * A settings row whose control fills all the width right of its label. The
 * label column has a fixed width, so the segmented controls of consecutive rows
 * line up.
 */
const SettingsSegmentRow = ({label, testID, children}: Props) => (
  <View style={styles.row} testID={testID}>
    <Text style={styles.label} testID={`${testID}-label`}>
      {label}
    </Text>
    <View style={styles.control}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  label: {
    width: 64,
    marginRight: 12,
  },
  control: {
    flex: 1,
  },
});

export default SettingsSegmentRow;
