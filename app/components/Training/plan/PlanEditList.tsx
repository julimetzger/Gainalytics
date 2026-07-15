import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated as RNAnimated, Pressable, StyleSheet, View} from 'react-native';
import {useNestableScrollContainerContext} from 'react-native-draggable-flatlist';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import type {PanGesture} from 'react-native-gesture-handler';
import {Chip, Icon, IconButton, Menu, Text, TextInput, ToggleButton, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {repetitionWeightByOneRm} from '../../../utils/AnalyseUtils';
import {useAllTimeOneRepMax} from '../../../redux/Workout/use/useAllTimeOneRepMax';
import DashedAddButton from '../../shared/DashedAddButton';
import {PendingPlanSet, PendingPlanSetByExerciseId, PlanField} from './planTypes';
import {buildWorkoutSetFromDraft, getPlanSetDraft} from './planUtils';

interface PlanEditListProps {
  exercises: Exercise[];
  selectedExerciseId?: number;
  plannedWorkoutsByExerciseId: Record<number, Workout | undefined>;
  pendingSetByExerciseId: PendingPlanSetByExerciseId;
  commitRowDraftsOnUnmountRef: React.MutableRefObject<boolean>;
  onSelectExercise: (exercise: Exercise) => void;
  onAddSet: (exerciseId: number) => void;
  onPendingSetChange: (exerciseId: number, field: PlanField, value: string) => void;
  onPendingSetDelete: (exerciseId: number) => void;
  onDeleteSet: (exerciseId: number, workoutSet: WorkoutSet) => void;
  onUpsertSet: (exerciseId: number, workoutSet: WorkoutSet) => void;
  onReorderSets: (exerciseId: number, sets: WorkoutSet[]) => void;
  onReorderExercises: (exercises: Exercise[]) => void;
  onRemoveExercise: (exercise: Exercise) => void;
}

type RowItem = {
  key: string;
  workoutSet: WorkoutSet;
};

type SectionItem = {
  key: string;
  exercise: Exercise;
};

const sortSets = (sets: WorkoutSet[]) => [...sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

// GH-324: given the drop displacement of a dragged section, find the index it
// should land on. Walks neighbouring section heights until less than half of
// the next section remains — the drop then "belongs" to that slot.
export function resolveSectionTargetIndex(index: number, translationY: number, heights: Record<number, number>, count: number): number {
  let target = index;
  let remaining = translationY;
  if (translationY > 0) {
    while (target < count - 1) {
      const nextHeight = heights[target + 1] ?? 0;
      if (nextHeight <= 0 || remaining < nextHeight / 2) {
        break;
      }
      remaining -= nextHeight;
      target += 1;
    }
  } else {
    while (target > 0) {
      const prevHeight = heights[target - 1] ?? 0;
      if (prevHeight <= 0 || -remaining < prevHeight / 2) {
        break;
      }
      remaining += prevHeight;
      target -= 1;
    }
  }
  return target;
}

interface DraggableItemWrapperProps {
  index: number;
  activeIndex: number | null;
  onDragStart: (index: number) => void;
  onDragEnd: (index: number, translationY: number) => void;
  onItemHeight: (index: number, height: number) => void;
  renderItem: (dragGesture: PanGesture) => React.ReactNode;
}

// GH-324: shared pan-drag wrapper for exercise sections AND set rows, replacing
// NestableDraggableFlatList in this screen. The library list broke Fabric
// drawing here twice over: nested inside another draggable list only the first
// cell rendered, and even plain-mapped a section containing one stopped every
// following sibling from being drawn. Mirrors the library's outer-scroll
// pattern: freeze the NestableScrollContainer while a drag is in flight.
//
// Deliberately uses the core react-native Animated API and gestures on the JS
// thread (.runOnJS(true)): a reanimated Animated.View with a useAnimatedStyle
// transform in this position also stopped Fabric from drawing the following
// siblings.
const DraggableItemWrapper = ({index, activeIndex, onDragStart, onDragEnd, onItemHeight, renderItem}: DraggableItemWrapperProps) => {
  const isActive = activeIndex === index;
  const translateYRef = useRef(new RNAnimated.Value(0));

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY([-4, 4])
        .onBegin(() => {
          onDragStart(index);
        })
        .onUpdate((event) => {
          translateYRef.current.setValue(event.translationY);
        })
        .onFinalize((event, success) => {
          translateYRef.current.setValue(0);
          onDragEnd(index, success ? event.translationY : 0);
        }),
    [index, onDragStart, onDragEnd],
  );

  return (
    <RNAnimated.View
      style={[{transform: [{translateY: translateYRef.current}]}, isActive && styles.activeSection]}
      onLayout={(event) => onItemHeight(index, event.nativeEvent.layout.height)}
    >
      {renderItem(dragGesture)}
    </RNAnimated.View>
  );
};

const PlanEditList = ({
  exercises,
  selectedExerciseId,
  plannedWorkoutsByExerciseId,
  pendingSetByExerciseId,
  commitRowDraftsOnUnmountRef,
  onSelectExercise,
  onAddSet,
  onPendingSetChange,
  onPendingSetDelete,
  onDeleteSet,
  onUpsertSet,
  onReorderSets,
  onReorderExercises,
  onRemoveExercise,
}: PlanEditListProps) => {
  const theme = useTheme();

  const sectionData = useMemo<SectionItem[]>(
    () =>
      exercises
        .filter((exercise) => exercise.id !== undefined)
        .map((exercise) => ({
          key: `plan-edit-section-${exercise.id}`,
          exercise,
        })),
    [exercises],
  );

  // GH-324: exercise sections are draggable via the two-stripe handle in the
  // section header, mirroring the set rows inside each section. The outer
  // scroll container is frozen while a section drag is in flight (same pattern
  // NestableDraggableFlatList uses internally).
  const nestableScrollContext = useNestableScrollContainerContext();
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const sectionHeightsRef = useRef<Record<number, number>>({});
  const sectionDataRef = useRef(sectionData);
  sectionDataRef.current = sectionData;

  const handleSectionHeight = useCallback((index: number, height: number) => {
    sectionHeightsRef.current[index] = height;
  }, []);

  const handleSectionDragStart = useCallback(
    (index: number) => {
      setActiveSectionIndex(index);
      nestableScrollContext?.setOuterScrollEnabled(false);
    },
    [nestableScrollContext],
  );

  const handleSectionDragEnd = useCallback(
    (index: number, translationY: number) => {
      setActiveSectionIndex(null);
      nestableScrollContext?.setOuterScrollEnabled(true);
      const sections = sectionDataRef.current;
      const targetIndex = resolveSectionTargetIndex(index, translationY, sectionHeightsRef.current, sections.length);
      if (targetIndex === index) {
        return;
      }
      const reordered = sections.map((section) => section.exercise);
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      onReorderExercises(reordered);
    },
    [nestableScrollContext, onReorderExercises],
  );

  return (
    <View style={styles.list}>
      {sectionData.map((item, index) => {
        const exerciseId = item.exercise.id as number;
        return (
          <DraggableItemWrapper
            key={item.key}
            index={index}
            activeIndex={activeSectionIndex}
            onDragStart={handleSectionDragStart}
            onDragEnd={handleSectionDragEnd}
            onItemHeight={handleSectionHeight}
            renderItem={(dragGesture) => (
              <PlanEditExerciseSection
                exercise={item.exercise}
                selected={exerciseId === selectedExerciseId}
                active={index === activeSectionIndex}
                sets={sortSets(plannedWorkoutsByExerciseId[exerciseId]?.sets ?? [])}
                pendingSet={pendingSetByExerciseId[exerciseId] ?? null}
                onSelect={() => onSelectExercise(item.exercise)}
                dragGesture={dragGesture}
                commitRowDraftsOnUnmountRef={commitRowDraftsOnUnmountRef}
                onAddSet={() => onAddSet(exerciseId)}
                onPendingSetChange={(field, value) => onPendingSetChange(exerciseId, field, value)}
                onPendingSetDelete={() => onPendingSetDelete(exerciseId)}
                onDeleteSet={(workoutSet) => onDeleteSet(exerciseId, workoutSet)}
                onUpsertSet={(workoutSet) => onUpsertSet(exerciseId, workoutSet)}
                onReorderSets={(reorderedSets) => onReorderSets(exerciseId, reorderedSets)}
                onRemoveExercise={() => onRemoveExercise(item.exercise)}
                outlineColor={withAlpha(theme.colors.primary, 0.18)}
                primaryColor={theme.colors.primary}
              />
            )}
          />
        );
      })}
    </View>
  );
};

interface SectionProps {
  exercise: Exercise;
  selected: boolean;
  active: boolean;
  sets: WorkoutSet[];
  pendingSet: PendingPlanSet | null;
  onSelect: () => void;
  dragGesture: PanGesture;
  commitRowDraftsOnUnmountRef: React.MutableRefObject<boolean>;
  onAddSet: () => void;
  onPendingSetChange: (field: PlanField, value: string) => void;
  onPendingSetDelete: () => void;
  onDeleteSet: (workoutSet: WorkoutSet) => void;
  onUpsertSet: (workoutSet: WorkoutSet) => void;
  onReorderSets: (sets: WorkoutSet[]) => void;
  onRemoveExercise: () => void;
  outlineColor: string;
  primaryColor: string;
}

const PlanEditExerciseSection = ({
  exercise,
  selected,
  active,
  sets,
  pendingSet,
  onSelect,
  dragGesture,
  commitRowDraftsOnUnmountRef,
  onAddSet,
  onPendingSetChange,
  onPendingSetDelete,
  onDeleteSet,
  onUpsertSet,
  onReorderSets,
  onRemoveExercise,
  outlineColor,
  primaryColor,
}: SectionProps) => {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const oneRepMax = useAllTimeOneRepMax(exercise.id);
  const data = useMemo<RowItem[]>(
    () =>
      sets.map((workoutSet) => ({
        key: `${workoutSet.index}-${workoutSet.weight}-${workoutSet.reps}-${workoutSet.rir}`,
        workoutSet,
      })),
    [sets],
  );

  const visibleCount = sets.length + (pendingSet ? 1 : 0);

  // GH-324: pan-drag reorder state for the set rows (same pattern as the
  // exercise sections in PlanEditList above).
  const nestableScrollContext = useNestableScrollContainerContext();
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const rowHeightsRef = useRef<Record<number, number>>({});
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleRowHeight = useCallback((rowIndex: number, height: number) => {
    rowHeightsRef.current[rowIndex] = height;
  }, []);

  const handleRowDragStart = useCallback(
    (rowIndex: number) => {
      setActiveRowIndex(rowIndex);
      nestableScrollContext?.setOuterScrollEnabled(false);
    },
    [nestableScrollContext],
  );

  const handleRowDragEnd = useCallback(
    (rowIndex: number, translationY: number) => {
      setActiveRowIndex(null);
      nestableScrollContext?.setOuterScrollEnabled(true);
      const rows = dataRef.current;
      const targetIndex = resolveSectionTargetIndex(rowIndex, translationY, rowHeightsRef.current, rows.length);
      if (targetIndex === rowIndex) {
        return;
      }
      const reordered = rows.map((row) => row.workoutSet);
      const [moved] = reordered.splice(rowIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      onReorderSets(reordered.map((workoutSet, position) => ({...workoutSet, index: position + 1})));
    },
    [nestableScrollContext, onReorderSets],
  );

  return (
    <View
      testID={`plan-edit-exercise-section-${exercise.id}`}
      style={[
        styles.section,
        {borderColor: outlineColor},
        selected && {borderLeftColor: primaryColor, borderLeftWidth: 2},
        active && {backgroundColor: theme.colors.secondaryContainer},
      ]}
    >
      <Pressable onPress={onSelect} style={styles.headerRow} testID={`plan-edit-exercise-header-${exercise.id}`}>
        <View style={styles.headerTitleRow}>
          {/* GH-324: the pan gesture lives only on the two-stripe handle so the
              rest of the header keeps its tap-to-select behaviour. */}
          <GestureDetector gesture={dragGesture}>
            <View testID={`plan-exercise-drag-handle-${exercise.id}`} style={styles.dragHandle} hitSlop={8}>
              <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
            </View>
          </GestureDetector>
          <Text
            style={[
              styles.title,
              {color: theme.colors.onSurface, fontWeight: selected ? '600' : '500'},
            ]}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Chip compact style={styles.chip}>
            {`${visibleCount} ${visibleCount === 1 ? 'set' : 'sets'}`}
          </Chip>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              testID={`plan-exercise-menu-button-${exercise.id}`}
              icon="dots-vertical"
              iconColor={theme.colors.onSurfaceVariant}
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            testID={`plan-remove-exercise-${exercise.id}`}
            leadingIcon="delete-outline"
            title="Remove exercise"
            onPress={() => {
              setMenuVisible(false);
              onRemoveExercise();
            }}
          />
        </Menu>
      </Pressable>
      {/* GH-324: set rows use the same custom pan-drag as the exercise
          sections. A NestableDraggableFlatList here breaks Fabric drawing of
          every sibling that follows its section (the "only the first exercise
          section is visible" bug). */}
      {data.map((item, rowIndex) => (
        <DraggableItemWrapper
          key={item.key}
          index={rowIndex}
          activeIndex={activeRowIndex}
          onDragStart={handleRowDragStart}
          onDragEnd={handleRowDragEnd}
          onItemHeight={handleRowHeight}
          renderItem={(rowDragGesture) => (
            <PlanEditSetRow
              workoutSet={item.workoutSet}
              oneRepMax={oneRepMax > 0 ? oneRepMax : undefined}
              onDelete={() => onDeleteSet(item.workoutSet)}
              dragGesture={rowDragGesture}
              commitRowDraftsOnUnmountRef={commitRowDraftsOnUnmountRef}
              onUpsert={onUpsertSet}
              active={rowIndex === activeRowIndex}
            />
          )}
        />
      ))}
      {pendingSet !== null && (
        <PendingPlanEditSetRow
          pendingSet={pendingSet}
          oneRepMax={oneRepMax > 0 ? oneRepMax : undefined}
          onChange={onPendingSetChange}
          onDelete={onPendingSetDelete}
        />
      )}
      <DashedAddButton
        label="Add set"
        testID={`plan-add-set-button-${exercise.id}`}
        onPress={onAddSet}
        style={styles.addButton}
      />
    </View>
  );
};

interface OneRmToggleProps {
  oneRepMax?: number;
  disabled1Rm: boolean;
  onToggle: () => void;
  testID: string;
}

// GH-324: the 1RM suggestion button is ALWAYS visible on plan edit rows. When
// the exercise has no recorded 1RM the toggle renders disabled so the row
// layout stays stable and the feature stays discoverable.
const OneRmToggle = ({oneRepMax, disabled1Rm, onToggle, testID}: OneRmToggleProps) => {
  const theme = useTheme();
  const hasOneRm = oneRepMax !== undefined;
  const showAsActive = hasOneRm && !disabled1Rm;

  return (
    <ToggleButton
      testID={testID}
      disabled={!hasOneRm}
      icon={() => (
        <Text style={{color: showAsActive ? theme.colors.primary : theme.colors.onSurfaceDisabled, fontSize: 11, fontWeight: '600'}}>1RM</Text>
      )}
      status={showAsActive ? 'checked' : 'unchecked'}
      onPress={onToggle}
      style={styles.oneRmToggle}
      size={28}
    />
  );
};

interface PlanEditSetRowProps {
  workoutSet: WorkoutSet;
  oneRepMax?: number;
  onDelete: () => void;
  dragGesture: PanGesture;
  commitRowDraftsOnUnmountRef: React.MutableRefObject<boolean>;
  onUpsert: (workoutSet: WorkoutSet) => void;
  active: boolean;
}

const PlanEditSetRow = ({
  workoutSet,
  oneRepMax,
  onDelete,
  dragGesture,
  commitRowDraftsOnUnmountRef,
  onUpsert,
  active,
}: PlanEditSetRowProps) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(() => getPlanSetDraft(workoutSet));
  const draftRef = useRef(draft);
  // GH-324: saved rows default to NOT auto-suggesting — the user planned this
  // weight deliberately; enabling the toggle opts back into 1RM suggestions.
  const [disable1RMWeightCalculation, setDisable1RMWeightCalculation] = useState(true);
  const lastSuggestedWeightRef = useRef<string | null>(null);
  const workoutSetRef = useRef(workoutSet);
  workoutSetRef.current = workoutSet;
  const onUpsertRef = useRef(onUpsert);
  onUpsertRef.current = onUpsert;

  useEffect(() => {
    const next = getPlanSetDraft(workoutSet);
    setDraft(next);
    draftRef.current = next;
  }, [workoutSet.index, workoutSet.reps, workoutSet.rir, workoutSet.weight]);

  // GH-324: when the user leaves full edit via Done/back while an input is
  // still focused, the row unmounts without blur. Only that full-edit exit
  // path should commit on unmount — reorder/delete unmount rows too and must
  // NOT write a stale draft back onto the old index.
  useEffect(
    () => () => {
      if (!commitRowDraftsOnUnmountRef.current) {
        return;
      }
      const current = workoutSetRef.current;
      const built = buildWorkoutSetFromDraft(draftRef.current, current);
      if (built !== null && (built.reps !== current.reps || built.rir !== current.rir || built.weight !== current.weight)) {
        onUpsertRef.current(built);
      }
    },
    [commitRowDraftsOnUnmountRef],
  );

  function updateField(field: PlanField, value: string) {
    let nextDraft = {
      ...draftRef.current,
      [field]: value.replace(',', '.'),
    };

    if (field === 'weight') {
      if (lastSuggestedWeightRef.current !== null && nextDraft.weight !== lastSuggestedWeightRef.current) {
        setDisable1RMWeightCalculation(true);
      }
    } else if (oneRepMax !== undefined && !disable1RMWeightCalculation) {
      const repsNum = Number.parseFloat(nextDraft.reps);
      const rirNum = Number.parseFloat(nextDraft.rir);
      if (Number.isFinite(repsNum) && Number.isFinite(rirNum) && repsNum > 0) {
        const computed = repetitionWeightByOneRm(repsNum, rirNum, oneRepMax).toFixed(0);
        lastSuggestedWeightRef.current = computed;
        nextDraft = {...nextDraft, weight: computed};
      }
    }

    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function handleToggle1RM() {
    setDisable1RMWeightCalculation((prev) => {
      const nextDisabled = !prev;
      if (!nextDisabled && oneRepMax !== undefined) {
        const repsNum = Number.parseFloat(draftRef.current.reps);
        const rirNum = Number.parseFloat(draftRef.current.rir);
        if (Number.isFinite(repsNum) && Number.isFinite(rirNum) && repsNum > 0) {
          const computed = repetitionWeightByOneRm(repsNum, rirNum, oneRepMax).toFixed(0);
          lastSuggestedWeightRef.current = computed;
          const nextDraft = {...draftRef.current, weight: computed};
          draftRef.current = nextDraft;
          setDraft(nextDraft);
        }
      }
      return nextDisabled;
    });
  }

  function commitDraft() {
    const nextSet = buildWorkoutSetFromDraft(draftRef.current, workoutSet);
    if (nextSet !== null) {
      onUpsert(nextSet);
    }
  }

  const weightIsStillSuggested = lastSuggestedWeightRef.current !== null && draft.weight === lastSuggestedWeightRef.current;
  const showHighlight = !disable1RMWeightCalculation && oneRepMax !== undefined && weightIsStillSuggested;
  const highlightColor = showHighlight ? theme.colors.primary : undefined;

  return (
    <View style={[styles.row, active && {backgroundColor: theme.colors.secondaryContainer}]}>
      <GestureDetector gesture={dragGesture}>
        <View testID={`plan-set-${workoutSet.index}-drag`} style={styles.dragHandle} hitSlop={8}>
          <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
        </View>
      </GestureDetector>
      <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{workoutSet.index}</Text>
      <TextInput
        mode="outlined"
        dense
        keyboardType="numeric"
        testID={`plan-set-${workoutSet.index}-reps-input`}
        label="Reps"
        value={draft.reps}
        error={draft.reps.length > 0 && buildWorkoutSetFromDraft({...draft, reps: draft.reps}, workoutSet) === null}
        style={styles.input}
        onChangeText={(value) => updateField('reps', value)}
        onBlur={commitDraft}
      />
      <TextInput
        mode="outlined"
        dense
        keyboardType="numeric"
        testID={`plan-set-${workoutSet.index}-rir-input`}
        label="RIR"
        value={draft.rir}
        error={draft.rir.length > 0 && buildWorkoutSetFromDraft({...draft, rir: draft.rir}, workoutSet) === null}
        style={styles.input}
        onChangeText={(value) => updateField('rir', value)}
        onBlur={commitDraft}
      />
      <TextInput
        mode="outlined"
        dense
        keyboardType="numeric"
        testID={`plan-set-${workoutSet.index}-weight-input`}
        label="Weight"
        value={draft.weight}
        error={draft.weight.length > 0 && buildWorkoutSetFromDraft({...draft, weight: draft.weight}, workoutSet) === null}
        style={styles.input}
        textColor={highlightColor}
        outlineColor={highlightColor}
        onChangeText={(value) => updateField('weight', value)}
        onBlur={commitDraft}
      />
      <OneRmToggle
        testID={`plan-set-${workoutSet.index}-1rm-toggle`}
        oneRepMax={oneRepMax}
        disabled1Rm={disable1RMWeightCalculation}
        onToggle={handleToggle1RM}
      />
      <IconButton testID={`plan-set-${workoutSet.index}-delete`} icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
    </View>
  );
};

interface PendingPlanEditSetRowProps {
  pendingSet: PendingPlanSet;
  oneRepMax?: number;
  onChange: (field: PlanField, value: string) => void;
  onDelete: () => void;
}

// GH-263 Item 2: inline weight-suggestion pattern ported from AddWorkoutSet.tsx.
// GH-324: the pending row no longer auto-commits while the user types. The draft
// stays pending until the user leaves the edit flow ("Add set" again or Done),
// so typing never converts the row under the user's finger. The 1RM toggle is
// always rendered (disabled when the exercise has no recorded 1RM).
const PendingPlanEditSetRow = ({pendingSet, oneRepMax, onChange, onDelete}: PendingPlanEditSetRowProps) => {
  const theme = useTheme();
  const [disable1RMWeightCalculation, setDisable1RMWeightCalculation] = useState(false);
  const lastSuggestedWeightRef = useRef<string | null>(null);

  const setWeightSuggestionFromReps = (repsValue: string, rirValue: string) => {
    if (oneRepMax === undefined || disable1RMWeightCalculation) {
      return;
    }
    const repsNum = Number.parseFloat(repsValue);
    const rirNum = Number.parseFloat(rirValue);
    if (!Number.isFinite(repsNum) || !Number.isFinite(rirNum) || repsNum <= 0) {
      return;
    }
    const computed = repetitionWeightByOneRm(repsNum, rirNum, oneRepMax).toFixed(0);
    lastSuggestedWeightRef.current = computed;
    onChange('weight', computed);
  };

  const handleRepsChange = (value: string) => {
    const next = value.replace(',', '.');
    onChange('reps', next);
    setWeightSuggestionFromReps(next, pendingSet.rir);
  };

  const handleRirChange = (value: string) => {
    const next = value.replace(',', '.');
    onChange('rir', next);
    setWeightSuggestionFromReps(pendingSet.reps, next);
  };

  const handleWeightChange = (value: string) => {
    const next = value.replace(',', '.');
    // If the user types a value that differs from the current suggestion, they
    // are overriding it — disable further auto-prefill.
    if (lastSuggestedWeightRef.current !== null && next !== lastSuggestedWeightRef.current) {
      setDisable1RMWeightCalculation(true);
    }
    onChange('weight', next);
  };

  const handleToggle1RM = () => {
    setDisable1RMWeightCalculation((prev) => {
      const nextDisabled = !prev;
      if (!nextDisabled) {
        // Re-enabling — recompute the suggestion from the current reps/rir.
        setWeightSuggestionFromReps(pendingSet.reps, pendingSet.rir);
      }
      return nextDisabled;
    });
  };

  // Show weight highlight whenever the suggestion is active and not overridden.
  const weightIsStillSuggested =
    lastSuggestedWeightRef.current !== null && pendingSet.weight === lastSuggestedWeightRef.current;
  const showHighlight = !disable1RMWeightCalculation && oneRepMax !== undefined && weightIsStillSuggested;
  const highlightColor = showHighlight ? theme.colors.primary : undefined;

  return (
    <View style={[styles.row, {backgroundColor: withAlpha(theme.colors.primary, 0.04)}]}>
      <View style={styles.dragHandle}>
        <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
      </View>
      <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{pendingSet.index}</Text>
      <TextInput
        testID="plan-pending-set-reps-input"
        mode="outlined"
        dense
        keyboardType="numeric"
        label="Reps"
        value={pendingSet.reps}
        style={styles.input}
        onChangeText={handleRepsChange}
      />
      <TextInput
        testID="plan-pending-set-rir-input"
        mode="outlined"
        dense
        keyboardType="numeric"
        label="RIR"
        value={pendingSet.rir}
        style={styles.input}
        onChangeText={handleRirChange}
      />
      <TextInput
        testID="plan-pending-set-weight-input"
        mode="outlined"
        dense
        keyboardType="numeric"
        label="Weight"
        value={pendingSet.weight}
        style={styles.input}
        textColor={highlightColor}
        outlineColor={highlightColor}
        onChangeText={handleWeightChange}
      />
      <OneRmToggle
        testID="plan-pending-set-1rm-toggle"
        oneRepMax={oneRepMax}
        disabled1Rm={disable1RMWeightCalculation}
        onToggle={handleToggle1RM}
      />
      <IconButton testID="plan-pending-set-delete" icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
  },
  activeSection: {
    zIndex: 100,
    elevation: 4,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  title: {
    fontSize: 15,
    flexShrink: 1,
  },
  chip: {
    minHeight: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingVertical: 6,
  },
  dragHandle: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setIndex: {
    width: 20,
    fontFamily: 'monospace',
    fontSize: 13,
    marginRight: 6,
  },
  input: {
    flex: 1,
    marginHorizontal: 2,
  },
  oneRmToggle: {
    marginHorizontal: 2,
    height: 32,
    width: 36,
  },
  addButton: {
    marginLeft: 28,
    marginRight: 16,
    marginTop: 8,
  },
});

export default PlanEditList;
