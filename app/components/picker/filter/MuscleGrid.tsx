import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, TouchableRipple, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';

interface MuscleGridProps {
  available: Muscles[];
  selected: Muscles[];
  setSelected: (muscles: Muscles[]) => void;
}

export const muscleTestID = (muscle: Muscles) => `filter-muscle-${String(muscle).replace(/ /g, '-')}`;

/** GH-642: the user's muscle list (GH-523) as a 3-column grid of ≥ 48 dp toggle buttons. */
const MuscleGrid = ({available, selected, setSelected}: MuscleGridProps) => {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {available.map((muscle) => {
        const isSelected = selected.includes(muscle);
        return (
          <View key={muscle} style={styles.cell}>
            <TouchableRipple
              testID={muscleTestID(muscle)}
              accessibilityRole="button"
              accessibilityState={{selected: isSelected}}
              onPress={() => setSelected(isSelected ? selected.filter((it) => it !== muscle) : [...selected, muscle])}
              borderless
              style={[
                styles.button,
                {borderRadius: theme.roundness * 2, borderColor: isSelected ? theme.colors.secondaryContainer : theme.colors.outlineVariant, backgroundColor: isSelected ? theme.colors.secondaryContainer : theme.colors.surface},
              ]}
            >
              <Text variant="labelLarge" numberOfLines={2} style={[styles.label, {color: isSelected ? theme.colors.onSecondaryContainer : theme.colors.onSurface}]}>
                {muscle}
              </Text>
            </TouchableRipple>
          </View>
        );
      })}
    </View>
  );
};

export default MuscleGrid;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -3,
  },
  cell: {
    width: '33.333%',
    padding: 3,
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  label: {
    textAlign: 'center',
  },
});
