import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Keyboard, LayoutRectangle, StyleSheet, View} from 'react-native';
import {Button, Dialog, Portal, Text, useTheme} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';
import {Exercise} from '../../../models/entities/Exercise';
import {Training} from '../../../models/entities/Training';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Action} from 'redux';
import {dispatchAddPlanedTrainingWorkout} from '../../../redux/Training/dispatch/plan/dispatchAddPlanedTrainingWorkout';
import {useNextTrainingsId} from '../../../redux/Training/use/useNextTrainingsId';
import {dispatchDeleteSetFromWorkout} from '../../../redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchReplaceWorkoutSets} from '../../../redux/Workout/dispatch/dispatchReplaceWorkoutSets';
import {GlobalState} from '../../../redux/rootReducer';
import {buildWorkoutSetFromDraft, cloneWorkoutSet, formatPlanNumber, getPlanFieldLabel, isPlanFieldValueValid} from './planUtils';
import {
  FullEditSnapshot,
  PendingPlanSetByExerciseId,
  PlanChromeState,
  PlanField,
  PlanMode,
  QuickEditTarget,
} from './planTypes';
import PlanEditList from './PlanEditList';
import PlanReadList from './PlanReadList';
import DraggableExercise from '../DraggableExercise';
import TrainingElementPicker from '../../picker/elements/TrainingElementPicker';
import MuscleInvolvementCard from './MuscleInvolvementCard';
import {useSettings} from '../../../redux/settings/use/useSettings';

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
  const appSettings = useSettings();
  const selectedExercise = chosenExercise ?? exercises[0];
  const nextTrainingId = useNextTrainingsId();
  const addPlannedWorkout = dispatchAddPlanedTrainingWorkout();
  const deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
  const replaceWorkoutSets = dispatchReplaceWorkoutSets();
  const dispatch = useDispatch();

  const plannedWorkoutsByExerciseId = useSelector((state: GlobalState) => {
    const workouts: Record<number, Workout | undefined> = {};
    Object.entries(training.plannedWorkouts ?? {}).forEach(([exerciseId, workoutId]) => {
      workouts[Number(exerciseId)] = state.workouts.byId[workoutId];
    });
    return workouts;
  }, shallowEqual);

  const [mode, setMode] = useState<PlanMode>('read');
  const [quickEditTarget, setQuickEditTarget] = useState<QuickEditTarget | null>(null);
  const [quickEditDraft, setQuickEditDraft] = useState('');
  const [quickEditOriginal, setQuickEditOriginal] = useState<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [pendingSetByExerciseId, setPendingSetByExerciseId] = useState<PendingPlanSetByExerciseId>({});
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [hasStructuralChanges, setHasStructuralChanges] = useState(false);
  const fullEditSnapshotRef = useRef<FullEditSnapshot | null>(null);
  const lastEditPlanRequestIdRef = useRef(editPlanRequestId);
  const exitToReadRef = useRef<() => void>(() => undefined);
  const handleBackRef = useRef<() => boolean>(() => false);

  // Stable wrappers: their identity never changes, but they always invoke the
  // latest closure of exitToRead/handleBack via refs. This keeps the chrome
  // effect deps stable and prevents an infinite re-render loop with the parent.
  const stableExitToRead = useCallback(() => exitToReadRef.current(), []);
  const stableHandleBack = useCallback(() => handleBackRef.current(), []);

  const activeQuickEditSet = useMemo(() => {
    if (quickEditTarget === null) {
      return undefined;
    }
    const workout = plannedWorkoutsByExerciseId[quickEditTarget.exerciseId];
    return workout?.sets.find((workoutSet) => workoutSet.index === quickEditTarget.setIndex);
  }, [plannedWorkoutsByExerciseId, quickEditTarget]);
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

  // Keep the latest-closure refs in sync with the hoisted function declarations
  // below, so the stable wrappers always call current state.
  exitToReadRef.current = exitToRead;
  handleBackRef.current = handleBack;

  useEffect(() => {
    if (!isActive || onChromeChange === undefined) {
      return;
    }

    onChromeChange({
      mode,
      exitToRead: stableExitToRead,
      handleBack: stableHandleBack,
    });

    return () => {
      onChromeChange({
        mode: 'read',
        exitToRead: () => undefined,
        handleBack: () => false,
      });
    };
  }, [isActive, mode, onChromeChange, stableExitToRead, stableHandleBack]);

  if (selectedExercise === undefined) {
    return null;
  }

  const quickEditExerciseName =
    quickEditTarget !== null
      ? exercises.find((exercise) => exercise.id === quickEditTarget.exerciseId)?.name ?? selectedExercise.name
      : selectedExercise.name;

  return (
    <View style={styles.container}>
      {appSettings.plan?.muscleMap?.enabled && (
        <MuscleInvolvementCard trainingsPlanId={trainingsPlanId} micro={micro} trainingInMicro={trainingInMicro} />
      )}
      <DraggableExercise
        exercises={exercises}
        chosenExercise={selectedExercise}
        chooseExercise={handleChooseExercise}
        onExerciseDoublePress={onExerciseDoublePress}
        doneExerciseIds={doneExerciseIds}
        setExercises={handleSetExercises}
        setAbsolutePosition={setAbsolutePosition}
        onTogglePicker={onTogglePicker}
        pickerVisible={pickerVisible}
      />
      <TrainingElementPicker
        exercise={exercises}
        setExercise={(nextExercises: Exercise[]) => handleSetExercises(nextExercises, true)}
        dropdownLabel="Select Exercises for your Training"
        hideChip={true}
        visible={pickerVisible}
        onToggle={onTogglePicker}
        hideIconButton={true}
      />
      {mode === 'fullEdit' ? (
        <PlanEditList
          exercises={exercises}
          selectedExerciseId={selectedExercise.id}
          plannedWorkoutsByExerciseId={plannedWorkoutsByExerciseId}
          pendingSetByExerciseId={pendingSetByExerciseId}
          onSelectExercise={chooseExercise}
          onAddSet={handleAddSet}
          onPendingSetChange={handlePendingSetChange}
          onPendingSetDelete={handlePendingSetDelete}
          onDeleteSet={handleDeleteSet}
          onUpsertSet={handleFullEditUpsertSet}
          onReorderSets={handleReorderSets}
          onRemoveExercise={handleRemoveExercise}
        />
      ) : (
        <PlanReadList
          exercises={exercises}
          selectedExerciseId={selectedExercise.id}
          plannedWorkoutsByExerciseId={plannedWorkoutsByExerciseId}
          mode={mode}
          quickEditTarget={quickEditTarget}
          quickEditDraft={quickEditDraft}
          quickEditInvalid={quickEditInvalid}
          onCellPress={handleReadCellPress}
          onQuickEditChange={handleQuickEditChange}
          onQuickEditSubmit={handleQuickEditDone}
          onQuickEditOutsidePress={handleQuickEditOutsidePress}
          onSelectExercise={chooseExercise}
        />
      )}
      <Portal>
        {mode === 'quickEdit' && quickEditTarget !== null && (
          <View style={[styles.quickEditAccessory, {backgroundColor: theme.colors.elevation.level3, bottom: keyboardInset > 0 ? keyboardInset : safeAreaInsets.bottom}]}>
            <Text style={[styles.quickEditLabel, {color: theme.colors.onSurfaceVariant}]}>
              {`Editing ${getPlanFieldLabel(quickEditTarget.field).toLowerCase()} · Set ${quickEditTarget.setIndex} · ${quickEditExerciseName}`}
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
    setPendingSetByExerciseId({});
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
    setPendingSetByExerciseId({});
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

  function handleReadCellPress(exerciseId: number, setIndex: number, field: PlanField) {
    const workout = plannedWorkoutsByExerciseId[exerciseId];
    const workoutSet = workout?.sets.find((set) => set.index === setIndex);
    if (workoutSet === undefined) {
      return;
    }

    const exercise = exercises.find((current) => current.id === exerciseId);
    if (exercise !== undefined && exerciseId !== selectedExercise.id) {
      chooseExercise(exercise);
    }

    if (
      mode === 'quickEdit' &&
      quickEditTarget !== null &&
      quickEditTarget.exerciseId === exerciseId &&
      quickEditTarget.setIndex === setIndex &&
      quickEditTarget.field === field
    ) {
      return;
    }

    if (mode === 'quickEdit' && quickEditInvalid) {
      restoreQuickEditOriginal();
    }

    setMode('quickEdit');
    setQuickEditTarget({
      exerciseId,
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
    upsertSetInPlan(target.exerciseId, {
      ...activeQuickEditSet,
      [target.field]: normalizedValue,
    });
  }

  function restoreQuickEditOriginal() {
    if (quickEditTarget === null || quickEditOriginal === null || activeQuickEditSet === undefined) {
      return;
    }
    upsertSetInPlan(quickEditTarget.exerciseId, {
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

  function handleAddSet(exerciseId: number) {
    // GH-240: never silently no-op. If there is already a pending row, commit it
    // (when valid) and continue adding a new pending. When the pending row still
    // has invalid values we leave it untouched — the user can finish or delete it,
    // but we don't drop their click.
    let pending = pendingSetByExerciseId[exerciseId];
    if (pending !== undefined) {
      const built = buildWorkoutSetFromDraft(pending, {
        index: pending.index,
        date: new Date(),
        reps: 0,
        rir: 0,
        weight: 0,
      });
      if (built === null) {
        // Invalid pending — keep it so the user can fix it; don't add a second
        // empty row on top of it.
        return;
      }
      upsertSetInPlan(exerciseId, built);
    }
    const sets = plannedWorkoutsByExerciseId[exerciseId]?.sets ?? [];
    const lastSavedIndex = sets.map((workoutSet) => workoutSet.index ?? 0).sort((left, right) => left - right).pop() ?? 0;
    const lastPendingIndex = pending?.index ?? 0;
    const nextIndex = Math.max(lastSavedIndex, lastPendingIndex) + 1;
    setPendingSetByExerciseId((current) => ({
      ...current,
      [exerciseId]: {
        index: nextIndex,
        reps: '',
        rir: '0',
        weight: '',
      },
    }));
    setHasStructuralChanges(true);
  }

  function handlePendingSetChange(exerciseId: number, field: PlanField, value: string) {
    setPendingSetByExerciseId((current) => {
      const existing = current[exerciseId];
      if (existing === undefined) {
        return current;
      }
      return {
        ...current,
        [exerciseId]: {
          ...existing,
          [field]: value.replace(',', '.'),
        },
      };
    });
  }

  function handlePendingSetDelete(exerciseId: number) {
    setPendingSetByExerciseId((current) => {
      if (current[exerciseId] === undefined) {
        return current;
      }
      const next = {...current};
      delete next[exerciseId];
      return next;
    });
  }

  function clearPendingSetIfMatchingIndex(exerciseId: number, index: number | undefined) {
    if (index === undefined) {
      return;
    }
    setPendingSetByExerciseId((current) => {
      const existing = current[exerciseId];
      if (existing === undefined || existing.index !== index) {
        return current;
      }
      const next = {...current};
      delete next[exerciseId];
      return next;
    });
  }

  function handleFullEditUpsertSet(exerciseId: number, workoutSet: WorkoutSet) {
    upsertSetInPlan(exerciseId, workoutSet);
    clearPendingSetIfMatchingIndex(exerciseId, workoutSet.index);
  }

  function upsertSetInPlan(exerciseId: number, workoutSet: WorkoutSet) {
    const plannedWorkout = plannedWorkoutsByExerciseId[exerciseId];

    if (plannedWorkout?.id === undefined) {
      addPlannedWorkout(
        trainingsPlanId,
        micro,
        trainingInMicro,
        exerciseId,
        {
          sets: [{...workoutSet, index: workoutSet.index ?? 1}],
          notes: '',
          exerciseId,
          start: new Date(Date.now()),
          trainingsId: training?.id ?? nextTrainingId,
        },
        training?.id,
      );
      return;
    }

    dispatch({
      type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
      set: workoutSet,
      workoutId: plannedWorkout.id,
    } as Action);
  }

  function handleDeleteSet(exerciseId: number, workoutSet: WorkoutSet) {
    const plannedWorkout = plannedWorkoutsByExerciseId[exerciseId];
    if (plannedWorkout === undefined) {
      return;
    }
    deleteSetFromWorkout(workoutSet, plannedWorkout);
    setHasStructuralChanges(true);
  }

  function handleReorderSets(exerciseId: number, reorderedSets: WorkoutSet[]) {
    const plannedWorkout = plannedWorkoutsByExerciseId[exerciseId];
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
    if (selectedExercise.id === exercise.id) {
      const nextSelectedExercise = nextExercises[0];
      if (nextSelectedExercise !== undefined) {
        chooseExercise(nextSelectedExercise);
      }
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
