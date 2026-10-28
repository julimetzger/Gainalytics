import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {useAlleExercises} from '../../../redux/Exercises/use/useAllExercises';
import {useExerciseTrainingStats} from '../../../redux/Workout/use/useExerciseTrainingStats';
import {quickPickExercises, toggleExercise} from '../../../utils/filter-panel';

interface ExerciseQuickPicksProps {
  selected: Exercise[];
  setSelected: (exercises: Exercise[]) => void;
}

/** GH-642: the most-trained exercises plus every selected one as one-tap toggle chips. */
const ExerciseQuickPicks = ({selected, setSelected}: ExerciseQuickPicksProps) => {
  const theme = useTheme();
  const allExercises = useAlleExercises();
  const stats = useExerciseTrainingStats();
  const chips = useMemo(() => quickPickExercises(allExercises, stats, selected), [allExercises, stats, selected]);

  if (chips.length === 0) {
    return (
      <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="filter-exercise-empty">
        Nothing trained yet — use Search all to pick any exercise.
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      {chips.map((exercise) => {
        const isSelected = selected.some((it) => it.id === exercise.id);
        return (
          <Chip key={exercise.id} testID={`filter-exercise-chip-${exercise.id}`} selected={isSelected} mode={isSelected ? 'flat' : 'outlined'} onPress={() => setSelected(toggleExercise(selected, exercise))}>
            {exercise.name}
          </Chip>
        );
      })}
    </View>
  );
};

export default ExerciseQuickPicks;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
