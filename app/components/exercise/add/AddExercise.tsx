import {Button, Dialog, IconButton, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {StyleSheet, View} from 'react-native';
import React, {useState} from 'react';
import {useDispatchAddExercise} from '../../../redux/Exercises/dispatch/dispatchAddExercise';
import {dispatchEditExercise} from '../../../redux/Exercises/dispatch/dispatchEditExercise';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {dispatchDeleteExercise} from '../../../redux/Exercises/dispatch/dispatchDeleteExercise';
import MusclePicker from './MusclePicker';
import {MusclePercentPair} from '../../../models/entities/Exercise';
import ExerciseAlternativesField from './ExerciseAlternativesField';

interface AddExerciseProperties {
  style?: any;
  exerciseId?: number;
}

const AddExercise = ({style, exerciseId}: AddExerciseProperties) => {
  const [visible, setVisible] = React.useState(false);
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
  const showDialog = () => {
    setError(undefined);
    setNewExerciseName(exercise?.name ?? '');
    setMuscles(exercise?.muscles ?? []);
    setAlternativeIds(exercise?.alternativeIds ?? []);
    setVisible(true);
  };
  const hideDialog = () => {
    setVisible(false);
    setDeleteOverlay(false);
    setError(undefined);
  };
  const confirmDialog = () => {
    let undefinedMuscles = muscles.find((muscle) => muscle.percent === undefined || muscle.muscle === undefined);
    if (undefinedMuscles) {
      setError('Please fill in all the muscles and percentages or remove the muscle.');
      return;
    }
    if (newExerciseName === '') {
      setError('Please fill in the name of the exercise');
      return;
    }
    setVisible(false);
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
                {muscles.map((muscleFromMap: MusclePercentPair) => {
                  return (
                    <MusclePicker
                      muscleValue={muscleFromMap}
                      key={muscleFromMap.muscle}
                      setMuscles={(muscle) => setMuscles([...muscles.filter((value) => value != muscleFromMap), muscle])}
                      onDelete={(value) => setMuscles([...muscles.filter((m) => m !== value)])}
                    />
                  );
                })}
                <Button onPress={() => setMuscles([...muscles, {muscle: undefined, percent: undefined}])}>Add Muscle Group</Button>
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
});
