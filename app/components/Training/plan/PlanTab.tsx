import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Keyboard, LayoutRectangle, StyleSheet, View} from 'react-native';
import {Button, Dialog, Portal, Text, useTheme} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {Exercise} from '../../../models/entities/Exercise';
import {Training} from '../../../models/entities/Training';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {dispatchAddPlanedTrainingWorkout} from '../../../redux/Training/dispatch/plan/dispatchAddPlanedTrainingWorkout';
import {useNextTrainingsId} from '../../../redux/Training/use/useNextTrainingsId';
import {dispatchAddOrUpdateSetInWorkout} from '../../../redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {dispatchDeleteSetFromWorkout} from '../../../redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchReplaceWorkoutSets} from '../../../redux/Workout/dispatch/dispatchReplaceWorkoutSets';
import {GlobalState} from '../../../redux/rootReducer';
import {cloneWorkoutSet, formatPlanNumber, getPlanFieldLabel, isPlanFieldValueValid} from './planUtils';
import {FullEditSnapshot, PendingPlanSet, PlanChromeState, PlanField, PlanMode, QuickEditTarget} from './planTypes';
import PlanEditList from './PlanEditList';
import PlanExerciseStrip from './PlanExerciseStrip';
import PlanReadList from './PlanReadList';
import TrainingElementPicker from '../../picker/elements/TrainingElementPicker';

interface PlanTabProps {
  training: Training;
  trainingsPlanId: number;
  micro: number;
  trainingInMicro: number;
  exercises: Exercise[];
  chosenExercise?: Exercise;
  chooseExercise: (exercise: Exercise) => void;
  onExerciseDoublePress?: (exercise: Exercise) => void;
  setExercises: (exercises: Exercise[]) => void;
  doneExerciseIds: number[];
  setAbsolutePosition: (layout: LayoutRectangle) => void;
  pickerVisible: boolean;
  onTogglePicker: () => void;
  editPlanRequestId: number;
  isActive?: boolean;
  onChromeChange?: (state: PlanChromeState) => void;
}

const PlanTab = ({
  training,
  trainingsPlanId,
  micro,
  trainingInMicro,
  exercises,
  chosenExercise,
  chooseExercise,
  onExerciseDoublePress,
  setExercises,
  doneExerciseIds,
  setAbsolutePosition,
  pickerVisible,
  onTogglePicker,
  editPlanRequestId,
  isActive = true,
  onChromeChange,
}: PlanTabProps) => {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const selectedExercise = chosenExercise ?? exercises[0];
  const nextTrainingId = useNextTrainingsId();
  const addPlannedWorkout = dispatchAddPlanedTrainingWorkout();
  const addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout(selectedExercise as Exercise, true);
  const deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
  const replaceWorkoutSets = dispatchReplaceWorkoutSets();

  const plannedWorkoutsByExerciseId = useSelector((state: GlobalState) => {
    const workouts: Record<number, Workout | undefined> = {};
    Object.entries(training.plannedWorkouts ?? {}).forEach(([exerciseId, workoutId]) => {
      workouts[Number(exerciseId)] = state.workouts.byId[workoutId];
    });
    return workouts;
  });

  const [mode, setMode] = useState<PlanMode>('read');
  const [quickEditTarget, setQuickEditTarget] = useState<QuickEditTarget | null>(null);
  const [quickEditDraft, setQuickEditDraft] = useState('');
  const [quickEditOriginal, setQuickEditOriginal] = useState<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [pendingSet, setPendingSet] = useState<PendingPlanSet | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [hasStructuralChanges, setHasStructuralChanges] = useState(false);
  const fullEditSnapshotRef = useRef<FullEditSnapshot | null>(null);
  const lastEditPlanRequestIdRef = useRef(editPlanRequestId);

  const plannedWorkout = selectedExercise?.id !== undefined ? plannedWorkoutsByExerciseId[selectedExercise.id] : undefined;
  const plannedSets = useMemo(() => [...(plannedWorkout?.sets ?? [])].sort((left, right) => (left.index ?? 0) - (right.index ?? 0)), [plannedWorkout?.sets]);
  const activeQuickEditSet =
    quickEditTarget?.exerciseId !== undefined
      ? plannedWorkoutsByExerciseId[quickEditTarget.exerciseId]?.sets.find((workoutSet) => workoutSet.index === quickEditTarget.setIndex)
      : undefined;
  const quickEditInvalid = quickEditTarget !== null && !isPlanFieldValueValid(quickEditTarget.field, quickEditDraft);

  useEffect(() => {
    if (selectedExercise === undefined) {
      return;
    }
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardInset(event.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [selectedExercise]);

  useEffect(() => {
    if (!isActive || selectedExercise === undefined) {
      return;
    }
    if (editPlanRequestId === lastEditPlanRequestIdRef.current) {
      return;
    }
    lastEditPlanRequestIdRef.current = editPlanRequestId;
    enterFullEdit();
  }, [editPlanRequestId, isActive, selectedExercise]);

  useEffect(() => {
    if (!isActive || onChromeChange === undefined) {
      return;
    }

    onChromeChange({
      mode,
      exitToRead,
      handleBack,
    });

    return () => {
      onChromeChange({
        mode: 'read',
        exitToRead: () => undefined,
        handleBack: () => false,
      });
    };
  }, [exitToRead, handleBack, isActive, mode, onChromeChange]);

  if (selectedExercise === undefined) {
    return null;
  }

  return (
    <View style={styles.container}>
      <PlanExerciseStrip
        exercises={exercises}
        chosenExercise={selectedExercise}
        chooseExercise={handleChooseExercise}
        onExerciseDoublePress={onExerciseDoublePress}
        doneExerciseIds={doneExerciseIds}
        mode={mode}
        setExercises={handleSetExercises}
        setAbsolutePosition={setAbsolutePosition}
        onAddExercise={mode === 'fullEdit' ? onTogglePicker : undefined}
        pickerVisible={pickerVisible}
      />
      {mode === 'fullEdit' && (
        <TrainingElementPicker
          exercise={exercises}
          setExercise={handleSetExercises}
          dropdownLabel="Select Exercises for your Training"
          hideChip={true}
          visible={pickerVisible}
          onToggle={onTogglePicker}
          hideIconButton={true}
        />
      )}
      {mode === 'fullEdit' ? (
        <PlanEditList
          exercise={selectedExercise}
          exercises={exercises}
          sets={plannedSets}
          pendingSet={pendingSet}
          onAddSet={handleAddSet}
          onPendingSetChange={handlePendingSetChange}
          onPendingSetDelete={() => setPendingSet(null)}
          onDeleteSet={handleDeleteSet}
          onUpsertSet={handleFullEditUpsertSet}
          onReorderSets={handleReorderSets}
          onRemoveExercise={handleRemoveExercise}
        />
      ) : (
        <PlanReadList
          exercise={selectedExercise}
          sets={plannedSets}
          mode={mode}
          quickEditTarget={quickEditTarget}
          quickEditDraft={quickEditDraft}
          quickEditInvalid={quickEditInvalid}
          onCellPress={handleReadCellPress}
          onQuickEditChange={handleQuickEditChange}
          onQuickEditSubmit={handleQuickEditDone}
          onQuickEditOutsidePress={handleQuickEditOutsidePress}
        />
      )}
      <Portal>
        {mode === 'quickEdit' && quickEditTarget !== null && (
          <View style={[styles.quickEditAccessory, {backgroundColor: theme.colors.elevation.level3, bottom: keyboardInset > 0 ? keyboardInset : safeAreaInsets.bottom}]}>
            <Text style={[styles.quickEditLabel, {color: theme.colors.onSurfaceVariant}]}>
              {`Editing ${getPlanFieldLabel(quickEditTarget.field).toLowerCase()} · Set ${quickEditTarget.setIndex} · ${selectedExercise.name}`}
            </Text>
            <Button
              mode="contained"
              compact
              testID="plan-quick-edit-done"
              disabled={quickEditInvalid}
              onPress={handleQuickEditDone}
              style={styles.quickEditDoneButton}
              labelStyle={styles.quickEditDoneLabel}
            >
              Done
            </Button>
          </View>
        )}
        <Dialog visible={showDiscardDialog} onDismiss={() => setShowDiscardDialog(false)}>
          <Dialog.Title>Discard plan changes?</Dialog.Title>
          <Dialog.Content>
            <Text>Discard the structural plan changes made in full edit and return to read mode.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDiscardDialog(false)}>Keep editing</Button>
            <Button testID="plan-discard-structural-changes" onPress={discardFullEditChanges}>
              Discard
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );

  function exitToRead() {
    if (pickerVisible) {
      onTogglePicker();
    }
    setMode('read');
    setQuickEditTarget(null);
    setQuickEditDraft('');
    setQuickEditOriginal(null);
    setPendingSet(null);
    setShowDiscardDialog(false);
    setHasStructuralChanges(false);
    fullEditSnapshotRef.current = null;
  }

  function handleBack() {
    if (showDiscardDialog) {
      setShowDiscardDialog(false);
      return true;
    }

    if (mode === 'quickEdit') {
      cancelQuickEdit();
      return true;
    }

    if (mode === 'fullEdit') {
      if (hasStructuralChanges) {
        setShowDiscardDialog(true);
      } else {
        exitToRead();
      }
      return true;
    }

    return false;
  }

  function captureFullEditSnapshot() {
    fullEditSnapshotRef.current = {
      chosenExerciseId: selectedExercise.id,
      exercises: exercises.map((exercise) => ({...exercise})),
      setsByExerciseId: Object.fromEntries(
        exercises
          .filter((exercise) => exercise.id !== undefined)
          .map((exercise) => [exercise.id as number, (plannedWorkoutsByExerciseId[exercise.id as number]?.sets ?? []).map(cloneWorkoutSet)]),
      ),
    };
  }

  function enterFullEdit() {
    if (mode === 'quickEdit') {
      if (quickEditInvalid) {
        restoreQuickEditOriginal();
      }
      setQuickEditTarget(null);
      setQuickEditDraft('');
      setQuickEditOriginal(null);
    }

    captureFullEditSnapshot();
    setPendingSet(null);
    setHasStructuralChanges(false);
    setMode('fullEdit');
  }

  function discardFullEditChanges() {
    const snapshot = fullEditSnapshotRef.current;
    if (snapshot === null) {
      exitToRead();
      return;
    }

    handleSetExercises(snapshot.exercises, false);

    const exerciseIds = new Set<number>([
      ...snapshot.exercises.map((exercise) => exercise.id ?? 0),
      ...Object.keys(training.plannedWorkouts ?? {}).map((key) => parseInt(key, 10)),
    ]);

    exerciseIds.forEach((exerciseId) => {
      if (!exerciseId) {
        return;
      }
      const initialSets = snapshot.setsByExerciseId[exerciseId] ?? [];
      const currentWorkout = plannedWorkoutsByExerciseId[exerciseId];
      if (currentWorkout?.id !== undefined) {
        replaceWorkoutSets(currentWorkout.id, initialSets.map(cloneWorkoutSet));
        return;
      }
      if (initialSets.length > 0) {
        addPlannedWorkout(
          trainingsPlanId,
          micro,
          trainingInMicro,
          exerciseId,
          {
            sets: initialSets.map(cloneWorkoutSet),
            notes: '',
            exerciseId,
            start: new Date(Date.now()),
            trainingsId: training?.id ?? nextTrainingId,
          },
          training?.id,
        );
      }
    });

    const restoredExercise = snapshot.exercises.find((exercise) => exercise.id === snapshot.chosenExerciseId) ?? snapshot.exercises[0];
    if (restoredExercise !== undefined) {
      chooseExercise(restoredExercise);
    }
    exitToRead();
  }

  function handleSetExercises(nextExercises: Exercise[], markStructuralChange = mode === 'fullEdit') {
    setExercises(nextExercises);
    if (markStructuralChange) {
      setHasStructuralChanges(true);
    }
  }

  function handleChooseExercise(exercise: Exercise) {
    if (mode === 'quickEdit') {
      if (quickEditInvalid) {
        cancelQuickEdit();
      } else {
        handleQuickEditDone();
      }
    }
    chooseExercise(exercise);
  }

  function handleReadCellPress(setIndex: number, field: PlanField) {
    const workoutSet = plannedSets.find((set) => set.index === setIndex);
    if (workoutSet === undefined || selectedExercise.id === undefined) {
      return;
    }

    if (mode === 'quickEdit' && quickEditTarget !== null && quickEditTarget.setIndex === setIndex && quickEditTarget.field === field) {
      return;
    }

    if (mode === 'quickEdit' && quickEditInvalid) {
      restoreQuickEditOriginal();
    }

    setMode('quickEdit');
    setQuickEditTarget({
      exerciseId: selectedExercise.id,
      setIndex,
      field,
    });
    setQuickEditDraft(formatPlanNumber(workoutSet[field]));
    setQuickEditOriginal(workoutSet[field]);
  }

  function handleQuickEditChange(value: string) {
    const target = quickEditTarget;
    if (target === null || activeQuickEditSet === undefined) {
      return;
    }

    const nextDraft = value.replace(',', '.');
    setQuickEditDraft(nextDraft);

    if (!isPlanFieldValueValid(target.field, nextDraft)) {
      return;
    }

    const parsedValue = Number.parseFloat(nextDraft);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    const normalizedValue = target.field === 'weight' ? Math.round(parsedValue * 100) / 100 : Math.round(parsedValue);
    upsertSetInPlan({
      ...activeQuickEditSet,
      [target.field]: normalizedValue,
    });
  }

  function restoreQuickEditOriginal() {
    if (quickEditTarget === null || quickEditOriginal === null || activeQuickEditSet === undefined) {
      return;
    }
    upsertSetInPlan({
      ...activeQuickEditSet,
      [quickEditTarget.field]: quickEditOriginal,
    });
  }

  function cancelQuickEdit() {
    restoreQuickEditOriginal();
    setMode('read');
    setQuickEditTarget(null);
    setQuickEditDraft('');
    setQuickEditOriginal(null);
  }

  function handleQuickEditDone() {
    if (quickEditInvalid) {
      return;
    }
    setMode('read');
    setQuickEditTarget(null);
    setQuickEditDraft('');
    setQuickEditOriginal(null);
  }

  function handleQuickEditOutsidePress() {
    if (quickEditInvalid) {
      cancelQuickEdit();
      return;
    }
    handleQuickEditDone();
  }

  function handleAddSet() {
    if (pendingSet !== null) {
      return;
    }
    const nextIndex = (plannedSets.map((workoutSet) => workoutSet.index ?? 0).sort((left, right) => left - right).pop() ?? 0) + 1;
    setPendingSet({
      index: nextIndex,
      reps: '',
      rir: '0',
      weight: '',
    });
    setHasStructuralChanges(true);
  }

  function handlePendingSetChange(field: PlanField, value: string) {
    setPendingSet((currentPendingSet) => {
      if (currentPendingSet === null) {
        return currentPendingSet;
      }
      return {
        ...currentPendingSet,
        [field]: value.replace(',', '.'),
      };
    });
  }

  function handleFullEditUpsertSet(workoutSet: WorkoutSet) {
    upsertSetInPlan(workoutSet);
    setPendingSet((currentPendingSet) => (currentPendingSet?.index === workoutSet.index ? null : currentPendingSet));
  }

  function upsertSetInPlan(workoutSet: WorkoutSet) {
    if (selectedExercise.id === undefined) {
      return;
    }

    if (plannedWorkout?.id === undefined) {
      addPlannedWorkout(
        trainingsPlanId,
        micro,
        trainingInMicro,
        selectedExercise.id,
        {
          sets: [{...workoutSet, index: workoutSet.index ?? 1}],
          notes: '',
          exerciseId: selectedExercise.id,
          start: new Date(Date.now()),
          trainingsId: training?.id ?? nextTrainingId,
        },
        training?.id,
      );
      return;
    }

    addOrUpdateSetInWorkout(workoutSet, plannedWorkout);
  }

  function handleDeleteSet(workoutSet: WorkoutSet) {
    if (plannedWorkout === undefined) {
      return;
    }
    deleteSetFromWorkout(workoutSet, plannedWorkout);
    setHasStructuralChanges(true);
  }

  function handleReorderSets(reorderedSets: WorkoutSet[]) {
    if (plannedWorkout?.id === undefined) {
      return;
    }
    replaceWorkoutSets(plannedWorkout.id, reorderedSets.map(cloneWorkoutSet));
    setHasStructuralChanges(true);
  }

  function handleRemoveExercise(exercise: Exercise) {
    if (exercise.id === undefined) {
      return;
    }
    const nextExercises = exercises.filter((currentExercise) => currentExercise.id !== exercise.id);
    handleSetExercises(nextExercises);
    const nextSelectedExercise = nextExercises[0];
    if (nextSelectedExercise !== undefined) {
      chooseExercise(nextSelectedExercise);
    }
  }
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  quickEditAccessory: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  quickEditLabel: {
    flex: 1,
    fontSize: 12,
    marginRight: 12,
  },
  quickEditDoneButton: {
    borderRadius: 999,
  },
  quickEditDoneLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PlanTab;
export type {PlanChromeState} from './planTypes';
