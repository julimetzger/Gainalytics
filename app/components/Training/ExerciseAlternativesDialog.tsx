import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Divider, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../models/entities/Exercise';

interface Props {
  visible: boolean;
  exercise?: Exercise;
  alternatives: Exercise[];
  onDismiss: () => void;
  onSelect: (exercise: Exercise) => void;
}

const ExerciseAlternativesDialog = ({visible, exercise, alternatives, onDismiss, onSelect}: Props) => {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.surface, borderColor: theme.colors.outline}]}>
      <Text variant="titleSmall" style={styles.title}>
        {exercise ? `Alternatives for ${exercise.name}` : 'Alternatives'}
      </Text>
      <Divider style={styles.divider} />
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
      <Button onPress={onDismiss} style={styles.closeButton}>Close</Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 8,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  title: {
    marginBottom: 8,
  },
  divider: {
    marginBottom: 8,
  },
  options: {
    gap: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontStyle: 'italic',
    marginBottom: 8,
  },
  closeButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
});

export default ExerciseAlternativesDialog;
