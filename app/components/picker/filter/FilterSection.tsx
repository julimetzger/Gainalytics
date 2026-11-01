import React, {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';

interface FilterSectionProps {
  title: string;
  /** Optional text button at the right end of the title row ("Search all", "Clear"). */
  action?: {label: string; testID: string; onPress: () => void; disabled?: boolean; icon?: string};
  children: ReactNode;
  testID?: string;
}

/** GH-642: one titled block of the expanded filter panel. */
const FilterSection = ({title, action, children, testID}: FilterSectionProps) => {
  const theme = useTheme();
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.header}>
        <Text variant="labelLarge" style={{color: theme.colors.onSurfaceVariant}} testID={testID ? `${testID}-title` : undefined}>
          {title}
        </Text>
        {action && (
          <Button testID={action.testID} compact mode="text" icon={action.icon} onPress={action.onPress} disabled={action.disabled}>
            {action.label}
          </Button>
        )}
      </View>
      {children}
    </View>
  );
};

export default FilterSection;

const styles = StyleSheet.create({
  section: {
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
});
