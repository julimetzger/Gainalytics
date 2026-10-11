import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
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
import {useExerciseUsage} from '../../redux/Exercises/use/useExerciseUsage';

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const EditExerciseSheet = ({navigation, route}: Props) => {
  const theme = useTheme();
  const exerciseId = route.params?.exerciseId;
  const existing = useExercise(exerciseId);
  const isEdit = exerciseId !== undefined && existing !== undefined;
  const linkedWorkouts = useWorkoutsByExerciseId(exerciseId);
  const usage = useExerciseUsage(exerciseId);

  const [name, setName] = useState(existing?.name ?? '');
  const [isFocus, setIsFocus] = useState<boolean>(existing?.isFocus ?? false);
  const [muscles, setMuscles] = useState<MusclePercentPair[]>(existing?.muscles ?? []);
  const [alternativeIds, setAlternativeIds] = useState<number[]>(existing?.alternativeIds ?? []);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const alternativesY = useRef(0);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [searchScrollY, setSearchScrollY] = useState<number | undefined>(undefined);

  // GH-487: while the alternatives search is focused, pin it to the top of the sheet so the keyboard
  // covers neither the field nor the hits below it. A viewport-high spacer guarantees the offset is
  // reachable even when the list is short or the keyboard does not resize the window.
  const scrollToSearch = () => {
    if (searchScrollY !== undefined) scrollRef.current?.scrollTo({y: searchScrollY, animated: true});
  };
  const handleSearchFocus = useCallback((searchY: number) => {
    setSearchScrollY(Math.max(0, alternativesY.current + searchY - 8));
  }, []);
  const handleSearchBlur = useCallback(() => setSearchScrollY(undefined), []);
  // Re-pin when the target moves while focused (picked chips wrapping into new rows push the search down).
  useEffect(() => {
    if (searchScrollY !== undefined) scrollRef.current?.scrollTo({y: searchScrollY, animated: true});
  }, [searchScrollY]);

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
      title: isEdit ? `Edit ${existing?.name ?? ''}` : 'New Exercise',
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
      ref={scrollRef}
      onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      onContentSizeChange={scrollToSearch}
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
          ? 'Type a percent (0–100) for each involved muscle.'
          : `${activeMuscleCount} muscle${activeMuscleCount === 1 ? '' : 's'} with involvement`}
      </Text>
      <MuscleInvolvementEditor pairs={muscles} onChange={setMuscles} />

      <View onLayout={(e) => (alternativesY.current = e.nativeEvent.layout.y)}>
        <ExerciseAlternativesField
          exerciseId={exerciseId}
          alternativeIds={alternativeIds}
          onChange={setAlternativeIds}
          onSearchFocus={handleSearchFocus}
          onSearchBlur={handleSearchBlur}
        />
      </View>

      {isEdit && (
        <Button
          mode="outlined"
          onPress={handleDeletePress}
          textColor={theme.colors.error}
          style={styles.deleteButton}
          testID="edit-exercise-delete"
        >
          Delete Exercise
        </Button>
      )}

      {searchScrollY !== undefined && <View style={{height: viewportHeight}} testID="edit-exercise-search-spacer" />}

      <Portal>
        <Dialog
          visible={showDeleteDialog}
          onDismiss={() => setShowDeleteDialog(false)}
          testID="edit-exercise-delete-dialog"
        >
          <Dialog.Title>Delete {existing?.name ?? 'exercise'}?</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {usage.inRunningTraining && (
              <Text testID="edit-exercise-delete-running" style={{color: theme.colors.error}}>
                {usage.runningTrainingSets > 0
                  ? `It is part of your running training. It will be removed from it, together with the ${plural(usage.runningTrainingSets, 'set')} you logged there.`
                  : 'It is part of your running training and will be removed from it. No sets were logged for it there yet.'}
              </Text>
            )}
            {usage.plannedTrainings > 0 && (
              <Text testID="edit-exercise-delete-planned">It will be removed from {plural(usage.plannedTrainings, 'planned training')}.</Text>
            )}
            <Text testID="edit-exercise-delete-history">
              This will also delete {plural(linkedWorkouts.length, 'workout')}
              {usage.loggedSets > 0 ? ` (${plural(usage.loggedSets, 'set')})` : ''} from your history. This action cannot be undone.
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
  dialogContent: {
    gap: 8,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'EditExerciseSheet'>;

export default EditExerciseSheet;
