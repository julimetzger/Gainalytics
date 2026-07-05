import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Dialog, IconButton, Portal} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import ExerciseOneRmRecordsTable from '../../exercise/show/ExerciseOneRmRecordsTable';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  exercise: Exercise;
}

const ExerciseRecordsModal = ({visible, onDismiss, exercise}: Props) => {
  return (
    <Portal>
      <Dialog testID="exercise-records-modal" visible={visible} onDismiss={onDismiss}>
        <Dialog.Title numberOfLines={1}>Records: {exercise.name}</Dialog.Title>
        <Dialog.Content>
          <ScrollView style={styles.scrollContent}>
            <ExerciseOneRmRecordsTable exercise={exercise} emptyTestID="exercise-records-empty" />
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <IconButton testID="exercise-records-close" icon="close" onPress={onDismiss} />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {maxHeight: 360},
});

export default ExerciseRecordsModal;
