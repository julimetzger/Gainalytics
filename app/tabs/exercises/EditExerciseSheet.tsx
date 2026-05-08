import React, {useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Dialog, Icon, IconButton, Portal, Switch, Text, TextInput, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import {useExercise} from '../../redux/Exercises/use/useExercise';
import {useDispatchAddExercise} from '../../redux/Exercises/dispatch/dispatchAddExercise';
import {dispatchEditExercise} from '../../redux/Exercises/dispatch/dispatchEditExercise';
import {dispatchDeleteExercise} from '../../redux/Exercises/dispatch/dispatchDeleteExercise';
import {MusclePercentPair} from '../../models/entities/Exercise';
import MuscleInvolvementEditor from '../../components/exercise/add/MuscleInvolvementEditor';
import ExerciseAlternativesField from '../../components/exercise/add/ExerciseAlternativesField';
import {useWorkoutsByExerciseId} from '../../redux/Workout/use/useWorkoutsByExerciseId';

const EditExerciseSheet = ({navigation, route}: Props) => {
  const theme = useTheme();
  const exerciseId = route.params?.exerciseId;
  const existing = useExercise(exerciseId);
  const isEdit = exerciseId !== undefined && existing !== undefined;
  const linkedWorkouts = useWorkoutsByExerciseId(exerciseId);

  const [name, setName] = useState(existing?.name ?? '');
  const [isFocus, setIsFocus] = useState<boolean>(existing?.isFocus ?? false);
  const [muscles, setMuscles] = useState<MusclePercentPair[]>(existing?.muscles ?? []);
  const [alternativeIds, setAlternativeIds] = useState<number[]>(existing?.alternativeIds ?? []);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const addExercise = useDispatchAddExercise();
  const editExercise = dispatchEditExercise();
  const deleteExercise = dispatchDeleteExercise();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setIsFocus(existing.isFocus ?? false);
      setMuscles(existing.muscles ?? []);
      setAlternativeIds(existing.alternativeIds ?? []);
    }
  }, [existing]);

  const trimmedName = name.trim();
  const saveDisabled = trimmedName.length === 0;

  const activeMuscleCount = useMemo(
    () => muscles.filter((m) => m.muscle !== undefined && (m.percent ?? 0) > 0).length,
    [muscles],
  );

  const handleSave = () => {
    if (saveDisabled) return;
    if (isEdit && exerciseId !== undefined) {
      editExercise(exerciseId, trimmedName, muscles, alternativeIds, isFocus);
    } else {
      addExercise(trimmedName, muscles, alternativeIds, isFocus);
    }
    navigation.goBack();
  };

  const handleDeletePress = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (exerciseId !== undefined) {
      setShowDeleteDialog(false);
      deleteExercise(exerciseId);
      navigation.goBack();
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? `Edit ${existing?.name ?? ''}` : 'New exercise',
      headerRight: () => (
        <Button
          mode="text"
          onPress={handleSave}
          disabled={saveDisabled}
          testID="edit-exercise-save"
        >
          Save
        </Button>
      ),
      headerLeft: () => (
        <IconButton icon="close" onPress={() => navigation.goBack()} testID="edit-exercise-cancel" />
      ),
    });
  }, [navigation, saveDisabled, name, muscles, alternativeIds, isFocus, isEdit, existing?.name]);

  return (
    <ScrollView
      style={[styles.root, {backgroundColor: theme.colors.background}]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="edit-exercise-sheet"
    >
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.field}
        testID="edit-exercise-name"
        placeholder="e.g. Front squat"
        autoFocus={!isEdit}
      />

      <View style={styles.focusRow} testID="edit-exercise-focus-row">
        <View style={styles.focusLabel}>
          <Icon source="star" size={20} color={isFocus ? '#FFB300' : theme.colors.onSurfaceVariant} />
          <Text style={[styles.focusText, {color: theme.colors.onSurface}]}>Focus exercise</Text>
        </View>
        <Switch value={isFocus} onValueChange={setIsFocus} testID="edit-exercise-focus-switch" />
      </View>

      <Text variant="labelMedium" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
        Muscle involvement
      </Text>
      <Text variant="bodySmall" style={[styles.muscleHint, {color: theme.colors.onSurfaceVariant}]}>
        {activeMuscleCount === 0
          ? 'Tap 25 / 50 / 75 / 100 for each involved muscle.'
          : `${activeMuscleCount} muscle${activeMuscleCount === 1 ? '' : 's'} with involvement`}
      </Text>
      <MuscleInvolvementEditor pairs={muscles} onChange={setMuscles} />

      <ExerciseAlternativesField exerciseId={exerciseId} alternativeIds={alternativeIds} onChange={setAlternativeIds} />

      {isEdit && (
        <Button
          mode="outlined"
          onPress={handleDeletePress}
          textColor={theme.colors.error}
          style={styles.deleteButton}
          testID="edit-exercise-delete"
        >
          Delete exercise
        </Button>
      )}

      <Portal>
        <Dialog
          visible={showDeleteDialog}
          onDismiss={() => setShowDeleteDialog(false)}
          testID="edit-exercise-delete-dialog"
        >
          <Dialog.Title>Delete {existing?.name ?? 'exercise'}?</Dialog.Title>
          <Dialog.Content>
            <Text>
              This will also delete {linkedWorkouts.length} workout
              {linkedWorkouts.length === 1 ? '' : 's'}. This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)} testID="edit-exercise-delete-cancel">
              Cancel
            </Button>
            <Button onPress={handleDeleteConfirm} textColor={theme.colors.error} testID="edit-exercise-delete-confirm">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 64,
  },
  field: {
    marginBottom: 12,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  focusLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  focusText: {
    fontSize: 16,
  },
  sectionLabel: {
    marginTop: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  muscleHint: {
    marginTop: 4,
    marginBottom: 4,
  },
  deleteButton: {
    marginTop: 16,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'EditExerciseSheet'>;

export default EditExerciseSheet;
