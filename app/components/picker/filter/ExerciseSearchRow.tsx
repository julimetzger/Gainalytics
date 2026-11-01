import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Checkbox, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';

interface ExerciseSearchRowProps {
  exercise: Exercise;
  /** Secondary text at the right end, e.g. "2 days ago". */
  detail?: string;
  checked: boolean;
  onToggle: (exercise: Exercise) => void;
  testID: string;
}

/** GH-642: one checkbox row of the exercise search sheet; the whole row toggles. */
const ExerciseSearchRow = ({exercise, detail, checked, onToggle, testID}: ExerciseSearchRowProps) => {
  const theme = useTheme();
  return (
    <TouchableRipple testID={testID} accessibilityRole="checkbox" accessibilityState={{checked}} accessibilityLabel={exercise.name} onPress={() => onToggle(exercise)} style={styles.row}>
      <View style={styles.content} pointerEvents="none">
        <Checkbox.Android status={checked ? 'checked' : 'unchecked'} />
        <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>
          {exercise.name}
        </Text>
        {detail && (
          <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
            {detail}
          </Text>
        )}
      </View>
    </TouchableRipple>
  );
};

export default memo(ExerciseSearchRow);

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  name: {
    flex: 1,
  },
});
