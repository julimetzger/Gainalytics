import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../models/entities/Exercise';
import EditDialogScaffold from '../common/EditDialogScaffold';

interface Props {
  visible: boolean;
  exercise?: Exercise;
  alternatives: Exercise[];
  onDismiss: () => void;
  onSelect: (exercise: Exercise) => void;
}

const ExerciseAlternativesDialog = ({visible, exercise, alternatives, onDismiss, onSelect}: Props) => {
  const theme = useTheme();

  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onDismiss}
      title={exercise ? `Alternatives for ${exercise.name}` : 'Alternatives'}
      testID="exercise-alternatives-dialog"
      dismissTestID="exercise-alternatives-close"
      scrollable
    >
      {alternatives.length > 0 ? (
        <View style={styles.options}>
          {alternatives.map((alternative) => (
            <Button key={alternative.id} mode="outlined" onPress={() => onSelect(alternative)}>
              {alternative.name}
            </Button>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No Alternatives</Text>
      )}
    </EditDialogScaffold>
  );
};

const styles = StyleSheet.create({
  options: {
    gap: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontStyle: 'italic',
    marginBottom: 8,
  },
});

export default ExerciseAlternativesDialog;
