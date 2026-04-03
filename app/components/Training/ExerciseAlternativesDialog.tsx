import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Dialog, Portal, Text} from 'react-native-paper';
import {Exercise} from '../../models/entities/Exercise';

interface Props {
  visible: boolean;
  exercise?: Exercise;
  alternatives: Exercise[];
  onDismiss: () => void;
  onSelect: (exercise: Exercise) => void;
}

const ExerciseAlternativesDialog = ({visible, exercise, alternatives, onDismiss, onSelect}: Props) => {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{exercise ? `Alternatives for ${exercise.name}` : 'Alternatives'}</Dialog.Title>
        <Dialog.Content>
          {alternatives.length > 0 ? (
            <View style={styles.options}>
              {alternatives.map((alternative) => (
                <Button key={alternative.id} mode="outlined" onPress={() => onSelect(alternative)}>
                  {alternative.name}
                </Button>
              ))}
            </View>
          ) : (
            <Text>No alternatives available</Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  options: {
    gap: 8,
  },
});

export default ExerciseAlternativesDialog;
