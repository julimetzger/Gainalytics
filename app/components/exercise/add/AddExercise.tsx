import {Button, Dialog, IconButton, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {StyleSheet, View} from 'react-native';
import React, {useMemo, useState} from 'react';
import {useDispatchAddExercise} from '../../../redux/Exercises/dispatch/dispatchAddExercise';
import {dispatchEditExercise} from '../../../redux/Exercises/dispatch/dispatchEditExercise';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {dispatchDeleteExercise} from '../../../redux/Exercises/dispatch/dispatchDeleteExercise';
import {MusclePercentPair} from '../../../models/entities/Exercise';
import ExerciseAlternativesField from './ExerciseAlternativesField';
import MuscleInvolvementEditor from './MuscleInvolvementEditor';

interface AddExerciseProperties {
  style?: any;
  exerciseId?: number;
}

const AddExercise = ({style, exerciseId}: AddExerciseProperties) => {
  const [visible, setVisible] = React.useState(false);
  const [muscleEditorVisible, setMuscleEditorVisible] = useState(false);
  const [deleteOverlay, setDeleteOverlay] = useState(false);
  let dispatchAddExercise = useDispatchAddExercise();
  let exercise = exerciseId ? useExercise(exerciseId) : undefined;
  const [newExerciseName, setNewExerciseName] = useState(exercise?.name ?? '');
  const [muscles, setMuscles] = useState<MusclePercentPair[]>(exercise?.muscles ?? []);
  const [alternativeIds, setAlternativeIds] = useState<number[]>(exercise?.alternativeIds ?? []);
  const [error, setError] = useState<string>();
  let editExercise = dispatchEditExercise();
  let deleteExercise = dispatchDeleteExercise();
  let theme = useTheme();

  const activeMuscleCount = useMemo(
    () => muscles.filter((m) => m.muscle !== undefined && (m.percent ?? 0) > 0).length,
    [muscles],
  );

  const showDialog = () => {
    setError(undefined);
    setNewExerciseName(exercise?.name ?? '');
    setMuscles(exercise?.muscles ?? []);
    setAlternativeIds(exercise?.alternativeIds ?? []);
    setMuscleEditorVisible(false);
    setVisible(true);
  };
  const hideDialog = () => {
    setVisible(false);
    setMuscleEditorVisible(false);
    setDeleteOverlay(false);
    setError(undefined);
  };
  const confirmDialog = () => {
    if (newExerciseName === '') {
      setError('Please fill in the name of the exercise');
      return;
    }
    setError(undefined);
    setVisible(false);
    setMuscleEditorVisible(false);
    exerciseId ? editExercise(exerciseId, newExerciseName, muscles, alternativeIds) : dispatchAddExercise(newExerciseName, muscles, alternativeIds);
  };

  return (
    <View style={style}>
      {exerciseId ? (
        <IconButton icon={'dots-vertical'} onPress={() => showDialog()} theme={theme} testID={`edit-exercise-${exerciseId}`} />
      ) : (
        <IconButton icon="plus-circle" onPress={() => showDialog()} theme={theme} iconColor={theme.colors.tertiaryContainer} size={40} testID="add-exercise-button"></IconButton>
      )}
      <Portal>
        <Dialog visible={visible} onDismiss={hideDialog} theme={theme}>
          {!deleteOverlay && exerciseId && <Dialog.Title>{'Edit ' + exercise!!.name}</Dialog.Title>}
          {!deleteOverlay && !exerciseId && <Dialog.Title>Add new Exercise</Dialog.Title>}
          {deleteOverlay && <Dialog.Title>{'Delete ' + exercise!!.name}</Dialog.Title>}
          <Dialog.Content>
            {deleteOverlay ? (
              <Text>This action will delete the exercise and all workouts saved for the exercise. Are you sure you want to delete this exercise?</Text>
            ) : (
              <View>
                <TextInput value={newExerciseName} label={'Name of the Exercise'} onChangeText={(text) => setNewExerciseName(text)} />
                <Button mode="outlined" style={styles.muscleButton} onPress={() => setMuscleEditorVisible(true)}>
                  Muscle involvement
                </Button>
                <Text variant="bodySmall" style={[styles.muscleHint, {color: theme.colors.onSurfaceVariant}]}>
                  {activeMuscleCount === 0
                    ? 'No muscles set (tap to configure)'
                    : `${activeMuscleCount} muscle${activeMuscleCount === 1 ? '' : 's'} with involvement`}
                </Text>
                <ExerciseAlternativesField exerciseId={exerciseId} alternativeIds={alternativeIds} onChange={setAlternativeIds} />
              </View>
            )}
          </Dialog.Content>
          <Text style={[styles.errorText, {color: theme.colors.error}]}>{error}</Text>
          <Dialog.Actions style={styles.actions}>
            <Button onPress={hideDialog}>Cancel</Button>
            {exerciseId && (
              <Button
                textColor={theme.colors.tertiary}
                onPress={() => {
                  deleteOverlay ? deleteExercise(exerciseId) : setDeleteOverlay(true);
                }}
              >
                Delete
              </Button>
            )}
            {!deleteOverlay && <Button onPress={confirmDialog}>Done</Button>}
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <MuscleInvolvementEditor
        visible={muscleEditorVisible}
        onDismiss={() => setMuscleEditorVisible(false)}
        initialPairs={muscles}
        onApply={setMuscles}
      />
    </View>
  );
};

export default AddExercise;

const styles = StyleSheet.create({
  actions: {
    justifyContent: 'space-between',
  },
  errorText: {
    paddingHorizontal: 24,
  },
  muscleButton: {
    marginTop: 8,
  },
  muscleHint: {
    marginBottom: 8,
  },
});
