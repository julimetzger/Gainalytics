import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Animated as RNAnimated, Pressable, StyleSheet, View} from 'react-native';
import {GestureDetector} from 'react-native-gesture-handler';
import type {PanGesture} from 'react-native-gesture-handler';
import {Chip, HelperText, Icon, IconButton, Menu, Text, TextInput, ToggleButton, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {repetitionWeightByOneRm} from '../../../utils/AnalyseUtils';
import {hasAnyPlanRange} from '../../../utils/planRange';
import {useAllTimeOneRepMax} from '../../../redux/Workout/use/useAllTimeOneRepMax';
import DashedAddButton from '../../shared/DashedAddButton';
import {PendingPlanSet, PendingPlanSetByExerciseId, PlanCellTarget, PlanDraftField, PlanField, PlanSetDraft} from './planTypes';
import {useScrollController} from '../../common/KeyboardAwareScrollView';
import {buildWorkoutSetFromDraft, getPlanDraftRangeError, getPlanRangeError, getPlanSetDraft, getQuickEditError, planSetsEqual} from './planUtils';
import {DragItemBinding, DragPlaceholder, resolveSectionTargetIndex, useDragReorder} from './useDragReorder';

interface PlanEditListProps {
  exercises: Exercise[];
  selectedExerciseId?: number;
  plannedWorkoutsByExerciseId: Record<number, Workout | undefined>;
  pendingSetByExerciseId: PendingPlanSetByExerciseId;
  commitRowDraftsOnUnmountRef: React.MutableRefObject<boolean>;
  onSelectExercise: (exercise: Exercise) => void;
  onAddSet: (exerciseId: number) => void;
  onPendingSetChange: (exerciseId: number, field: PlanDraftField, value: string) => void;
  onPendingSetDelete: (exerciseId: number) => void;
  onDeleteSet: (exerciseId: number, workoutSet: WorkoutSet) => void;
  onUpsertSet: (exerciseId: number, workoutSet: WorkoutSet) => void;
  onReorderSets: (exerciseId: number, sets: WorkoutSet[]) => void;
  onReorderExercises: (exercises: Exercise[]) => void;
  onRemoveExercise: (exercise: Exercise) => void;
  /** GH-418: the read-view cell that opened full edit — its input gets the focus. */
  focusTarget?: PlanCellTarget | null;
  /** GH-418: the workout that was long-pressed to open full edit — scrolled into view. */
  revealExerciseId?: number | null;
}

type RowItem = {
  key: string;
  workoutSet: WorkoutSet;
};

type SectionItem = {
  key: string;
  exercise: Exercise;
};

/** GH-418: how far below the scroller's top a revealed (long-pressed) workout lands. */
const REVEAL_TOP_MARGIN = 8;

const PLAN_VALUE_FIELDS: PlanField[] = ['reps', 'rir', 'weight'];

/** Outer margin of an exercise section card. */
const SECTION_MARGIN = 12;

const sortSets = (sets: WorkoutSet[]) => [...sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

// GH-63: a pending (not yet saved) row carries its range in the draft strings.
const hasPendingRange = (draft: PlanSetDraft) =>
  draft.repsMax.trim().length > 0 || draft.rirMax.trim().length > 0 || draft.weightMax.trim().length > 0;

interface PlanFieldColumnProps {
  field: PlanField;
  label: string;
  testIDPrefix: string;
  value: string;
  maxValue: string;
  showRange: boolean;
  invalid: boolean;
  rangeInvalid: boolean;
  textColor?: string;
  outlineColor?: string;
  onChangeValue: (value: string) => void;
  onChangeMaxValue: (value: string) => void;
  onBlur?: () => void;
  /** Select the whole value on focus so typing replaces it (GH-436: suggested weights). */
  selectTextOnFocus?: boolean;
  /** GH-418: the field the user tapped in the read view. */
  autoFocus?: boolean;
}

// GH-63: one planned field. Without a range this renders exactly the single
// input the row always had; with a range a second "to" input appears directly
// underneath, so the two bounds stay visually attached to their field.
const PlanFieldColumn = ({
  field,
  label,
  testIDPrefix,
  value,
  maxValue,
  showRange,
  invalid,
  rangeInvalid,
  textColor,
  outlineColor,
  onChangeValue,
  onChangeMaxValue,
  onBlur,
  selectTextOnFocus,
  autoFocus,
}: PlanFieldColumnProps) => (
  <View style={styles.fieldColumn}>
    <TextInput
      mode="outlined"
      dense
      keyboardType="numeric"
      testID={`${testIDPrefix}-${field}-input`}
      label={label}
      value={value}
      error={invalid}
      onChangeText={onChangeValue}
      onBlur={onBlur}
      textColor={textColor}
      outlineColor={outlineColor}
      // GH-418: the row mounts together with full edit, so the focus has to be the
      // native autoFocus — a focus() call from an effect never opens the keyboard.
      // Selecting the value makes the first keystroke replace it.
      autoFocus={autoFocus}
      selectTextOnFocus={autoFocus === true ? true : selectTextOnFocus}
    />
    {showRange && (
      <TextInput
        mode="outlined"
        dense
        keyboardType="numeric"
        testID={`${testIDPrefix}-${field}-max-input`}
        label="to"
        placeholder="—"
        value={maxValue}
        error={rangeInvalid}
        style={styles.maxInput}
        onChangeText={onChangeMaxValue}
        onBlur={onBlur}
      />
    )}
  </View>
);

// GH-324: re-exported for the existing drop-target tests; the drag lives in useDragReorder now.
export {resolveSectionTargetIndex};

interface DragItemViewProps {
  binding: DragItemBinding;
  active: boolean;
  testID: string;
  children: React.ReactNode;
}

// GH-324 / GH-418: one draggable item — exercise section or set row. The pan
// gesture itself sits on the item's drag handle (passed down via `binding`), so
// the rest of the item keeps its taps and inputs.
const DragItemView = ({binding, active, testID, children}: DragItemViewProps) => (
  <RNAnimated.View testID={testID} style={[{transform: [{translateY: binding.translateY}]}, active && styles.activeItem]} onLayout={binding.onLayout}>
    {children}
  </RNAnimated.View>
);

interface DropPlaceholderProps {
  placeholder: DragPlaceholder | null;
  /** The item's own margins, so the outline matches the card rather than the slot. */
  inset: {left: number; right: number; bottom: number};
  borderRadius: number;
  testID: string;
}

// GH-418: outlines the slot the dragged item drops into. It moves with the gap
// the other items open up, underneath the dragged item.
const DropPlaceholder = ({placeholder, inset, borderRadius, testID}: DropPlaceholderProps) => {
  const theme = useTheme();
  if (placeholder === null) {
    return null;
  }
  return (
    <RNAnimated.View
      pointerEvents="none"
      testID={testID}
      style={[
        styles.placeholder,
        {
          top: 0,
          transform: [{translateY: placeholder.translateY}],
          height: Math.max(0, placeholder.height - inset.bottom),
          left: inset.left,
          right: inset.right,
          borderRadius,
          borderColor: theme.colors.primary,
          backgroundColor: withAlpha(theme.colors.primary, 0.08),
        },
      ]}
    />
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
  focusTarget = null,
  revealExerciseId = null,
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
  // section header, mirroring the set rows inside each section. GH-418: the drag
  // scrolls the plan along at the edges and shows where the section will land.
  const sectionDataRef = useRef(sectionData);
  sectionDataRef.current = sectionData;
  const handleSectionReorder = useCallback(
    (from: number, to: number) => {
      const reordered = sectionDataRef.current.map((section) => section.exercise);
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      onReorderExercises(reordered);
    },
    [onReorderExercises],
  );
  const sectionDrag = useDragReorder({count: sectionData.length, items: sectionData, onReorder: handleSectionReorder});

  return (
    <View style={styles.list}>
      <DropPlaceholder
        placeholder={sectionDrag.placeholder}
        inset={{left: SECTION_MARGIN, right: SECTION_MARGIN, bottom: SECTION_MARGIN}}
        borderRadius={20}
        testID="plan-edit-section-drop-placeholder"
      />
      {sectionData.map((item, index) => {
        const exerciseId = item.exercise.id as number;
        const binding = sectionDrag.bind(index);
        return (
          <DragItemView key={item.key} testID={`plan-edit-section-drag-item-${exerciseId}`} binding={binding} active={index === sectionDrag.activeIndex}>
              <PlanEditExerciseSection
                exercise={item.exercise}
                selected={exerciseId === selectedExerciseId}
                active={index === sectionDrag.activeIndex}
                sets={sortSets(plannedWorkoutsByExerciseId[exerciseId]?.sets ?? [])}
                pendingSet={pendingSetByExerciseId[exerciseId] ?? null}
                onSelect={() => onSelectExercise(item.exercise)}
                dragGesture={binding.gesture}
                commitRowDraftsOnUnmountRef={commitRowDraftsOnUnmountRef}
                onAddSet={() => onAddSet(exerciseId)}
                onPendingSetChange={(field, value) => onPendingSetChange(exerciseId, field, value)}
                onPendingSetDelete={() => onPendingSetDelete(exerciseId)}
                onDeleteSet={(workoutSet) => onDeleteSet(exerciseId, workoutSet)}
                onUpsertSet={(workoutSet) => onUpsertSet(exerciseId, workoutSet)}
                onReorderSets={(reorderedSets) => onReorderSets(exerciseId, reorderedSets)}
                onRemoveExercise={() => onRemoveExercise(item.exercise)}
                focusTarget={focusTarget !== null && focusTarget.exerciseId === exerciseId ? focusTarget : null}
                reveal={revealExerciseId === exerciseId}
                outlineColor={withAlpha(theme.colors.primary, 0.18)}
                primaryColor={theme.colors.primary}
              />
          </DragItemView>
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
  onPendingSetChange: (field: PlanDraftField, value: string) => void;
  onPendingSetDelete: () => void;
  onDeleteSet: (workoutSet: WorkoutSet) => void;
  onUpsertSet: (workoutSet: WorkoutSet) => void;
  onReorderSets: (sets: WorkoutSet[]) => void;
  onRemoveExercise: () => void;
  focusTarget: PlanCellTarget | null;
  reveal: boolean;
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
  focusTarget,
  reveal,
  outlineColor,
  primaryColor,
}: SectionProps) => {
  const theme = useTheme();
  const scrollController = useScrollController();
  const sectionRef = useRef<View>(null);
  const revealedRef = useRef(false);

  // GH-418: a long-pressed workout is scrolled to once full edit has laid it out —
  // the edit rows are taller than the read rows, so it would otherwise end up
  // somewhere below where the user pressed.
  const handleSectionLayout = () => {
    if (!reveal || revealedRef.current) {
      return;
    }
    revealedRef.current = true;
    scrollController?.scrollViewIntoView(sectionRef.current, REVEAL_TOP_MARGIN);
  };
  const [menuVisible, setMenuVisible] = useState(false);
  const oneRepMax = useAllTimeOneRepMax(exercise.id);
  const data = useMemo<RowItem[]>(
    () =>
      sets.map((workoutSet) => ({
        // Keyed by the set's identity only. A key that also carried the values
        // remounted the whole row on every commit, so the row's draft was rebuilt
        // from the store and anything typed into the next field since was lost —
        // exactly the two-fields-in-a-row rhythm of planning a range (GH-63).
        key: `plan-edit-set-${workoutSet.index}`,
        workoutSet,
      })),
    [sets],
  );

  // GH-63: the second value of each field ("8 to 12 reps") is opt-in per
  // exercise so a plan without ranges keeps the exact row it always had. The
  // extra inputs are forced open whenever a set already carries a range, so an
  // existing range is never hidden behind a collapsed toggle.
  const [rangesRequested, setRangesRequested] = useState(false);
  const someSetHasRange = sets.some(hasAnyPlanRange);
  const showRanges = rangesRequested || someSetHasRange;

  const visibleCount = sets.length + (pendingSet ? 1 : 0);

  // GH-324: pan-drag reorder for the set rows (same hook as the exercise
  // sections in PlanEditList above). The rows are renumbered in their new order.
  const dataRef = useRef(data);
  dataRef.current = data;
  const handleRowReorder = useCallback(
    (from: number, to: number) => {
      const reordered = dataRef.current.map((row) => row.workoutSet);
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      onReorderSets(reordered.map((workoutSet, position) => ({...workoutSet, index: position + 1})));
    },
    [onReorderSets],
  );
  const rowDrag = useDragReorder({count: data.length, items: data, onReorder: handleRowReorder});

  return (
    <View
      ref={sectionRef}
      onLayout={handleSectionLayout}
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
          <ToggleButton
            testID={`plan-exercise-ranges-toggle-${exercise.id}`}
            accessibilityLabel="Plan a range instead of a fixed value"
            icon={() => (
              <Icon
                source="arrow-expand-horizontal"
                size={16}
                color={showRanges ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
            )}
            status={showRanges ? 'checked' : 'unchecked'}
            onPress={() => setRangesRequested((previous) => !previous)}
            style={styles.rangeToggle}
            size={28}
          />
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
      <DropPlaceholder placeholder={rowDrag.placeholder} inset={{left: 8, right: 8, bottom: 0}} borderRadius={12} testID={`plan-edit-set-drop-placeholder-${exercise.id}`} />
      {data.map((item, rowIndex) => {
        const binding = rowDrag.bind(rowIndex);
        return (
          <DragItemView key={item.key} testID={`plan-edit-set-drag-item-${exercise.id}-${rowIndex}`} binding={binding} active={rowIndex === rowDrag.activeIndex}>
            <PlanEditSetRow
              workoutSet={item.workoutSet}
              oneRepMax={oneRepMax > 0 ? oneRepMax : undefined}
              showRanges={showRanges}
              onDelete={() => onDeleteSet(item.workoutSet)}
              dragGesture={binding.gesture}
              commitRowDraftsOnUnmountRef={commitRowDraftsOnUnmountRef}
              onUpsert={onUpsertSet}
              active={rowIndex === rowDrag.activeIndex}
              autoFocusField={focusTarget !== null && focusTarget.setIndex === item.workoutSet.index ? focusTarget.field : undefined}
            />
          </DragItemView>
        );
      })}
      {pendingSet !== null && (
        <PendingPlanEditSetRow
          // GH-406: each pending row is its own instance, so the 1RM suggestion
          // state and the "last suggested weight" ref start clean for each new
          // set instead of leaking from the row that was just committed.
          key={pendingSet.index}
          pendingSet={pendingSet}
          oneRepMax={oneRepMax > 0 ? oneRepMax : undefined}
          showRanges={showRanges || hasPendingRange(pendingSet)}
          onChange={onPendingSetChange}
          onDelete={onPendingSetDelete}
        />
      )}
      <DashedAddButton
        label="Add Set"
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
  showRanges: boolean;
  onDelete: () => void;
  dragGesture: PanGesture;
  commitRowDraftsOnUnmountRef: React.MutableRefObject<boolean>;
  onUpsert: (workoutSet: WorkoutSet) => void;
  active: boolean;
  autoFocusField?: PlanField;
}

const PlanEditSetRow = ({
  workoutSet,
  oneRepMax,
  showRanges,
  onDelete,
  dragGesture,
  commitRowDraftsOnUnmountRef,
  onUpsert,
  active,
  autoFocusField,
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
  // The last set this row wrote to the store. The store echoes it back one
  // render later — see the effect below.
  const lastCommittedRef = useRef<WorkoutSet | null>(null);

  // GH-418: a layout effect, so a reordered row shows its new values in the same
  // frame as the drop (rows are keyed by position, so a reorder hands each row
  // another set) instead of flashing the old numbers for one frame.
  useLayoutEffect(() => {
    // GH-63: leaving a field commits it, and the store echoes the new set back
    // into this prop. Re-deriving the draft from that echo would throw away
    // whatever the user has typed into the NEXT field in the meantime — the
    // upper bound of a range is the field this bites, because planning one means
    // filling the lower and the upper input back to back. Skip our own echo; a
    // change from anywhere else (undo, reorder, another editor) still wins.
    if (planSetsEqual(lastCommittedRef.current, workoutSet)) {
      return;
    }
    const next = getPlanSetDraft(workoutSet);
    setDraft(next);
    draftRef.current = next;
  }, [
    workoutSet.index,
    workoutSet.reps,
    workoutSet.rir,
    workoutSet.weight,
    workoutSet.repsMax,
    workoutSet.rirMax,
    workoutSet.weightMax,
  ]);

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
      if (
        built !== null &&
        (built.reps !== current.reps ||
          built.rir !== current.rir ||
          built.weight !== current.weight ||
          built.repsMax !== current.repsMax ||
          built.rirMax !== current.rirMax ||
          built.weightMax !== current.weightMax)
      ) {
        onUpsertRef.current(built);
      }
    },
    [commitRowDraftsOnUnmountRef],
  );

  function updateField(field: PlanDraftField, value: string) {
    let nextDraft = {
      ...draftRef.current,
      [field]: value.replace(',', '.'),
    };

    if (field === 'weight') {
      if (lastSuggestedWeightRef.current !== null && nextDraft.weight !== lastSuggestedWeightRef.current) {
        setDisable1RMWeightCalculation(true);
      }
    } else if ((field === 'reps' || field === 'rir') && oneRepMax !== undefined && !disable1RMWeightCalculation) {
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
    const nextSet = buildWorkoutSetFromDraft(draftRef.current, workoutSetRef.current);
    if (nextSet !== null) {
      lastCommittedRef.current = nextSet;
      onUpsert(nextSet);
    }
  }

  const weightIsStillSuggested = lastSuggestedWeightRef.current !== null && draft.weight === lastSuggestedWeightRef.current;
  const showHighlight = !disable1RMWeightCalculation && oneRepMax !== undefined && weightIsStillSuggested;
  const highlightColor = showHighlight ? theme.colors.primary : undefined;

  const testIDPrefix = `plan-set-${workoutSet.index}`;
  const showRange = showRanges || hasAnyPlanRange(workoutSet) || hasPendingRange(draft);
  const rangeError = getPlanDraftRangeError(draft);
  // Unchanged pre-GH-63 semantics: the three value inputs flag an invalid fixed
  // value. A broken range is reported by its own "to" input plus the message
  // below the row, so it never turns the untouched value inputs red.
  const valueInvalid = buildWorkoutSetFromDraft({...draft, repsMax: '', rirMax: '', weightMax: ''}, workoutSet) === null;
  // GH-418: values are edited here only (the read view's one-cell quick edit is
  // gone), so this row also says WHY a value is refused — the quick edit did, and
  // a red outline alone does not explain e.g. that RIR allows decimals.
  const valueError = PLAN_VALUE_FIELDS.map((field) => (draft[field].length > 0 ? getQuickEditError(undefined, field, draft[field]) : undefined)).find(
    (error) => error !== undefined,
  );

  return (
    <View>
      <View style={[styles.row, active && {backgroundColor: theme.colors.secondaryContainer}]}>
        <GestureDetector gesture={dragGesture}>
          <View testID={`${testIDPrefix}-drag`} style={styles.dragHandle} hitSlop={8}>
            <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
          </View>
        </GestureDetector>
        <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{workoutSet.index}</Text>
        <PlanFieldColumn
          field="reps"
          label="Reps"
          testIDPrefix={testIDPrefix}
          value={draft.reps}
          maxValue={draft.repsMax}
          showRange={showRange}
          invalid={draft.reps.length > 0 && valueInvalid}
          rangeInvalid={getPlanRangeError('reps', draft.reps, draft.repsMax) !== undefined}
          autoFocus={autoFocusField === 'reps'}
          onChangeValue={(value) => updateField('reps', value)}
          onChangeMaxValue={(value) => updateField('repsMax', value)}
          onBlur={commitDraft}
        />
        <PlanFieldColumn
          field="rir"
          label="RIR"
          testIDPrefix={testIDPrefix}
          value={draft.rir}
          maxValue={draft.rirMax}
          showRange={showRange}
          invalid={draft.rir.length > 0 && valueInvalid}
          rangeInvalid={getPlanRangeError('rir', draft.rir, draft.rirMax) !== undefined}
          autoFocus={autoFocusField === 'rir'}
          onChangeValue={(value) => updateField('rir', value)}
          onChangeMaxValue={(value) => updateField('rirMax', value)}
          onBlur={commitDraft}
        />
        <PlanFieldColumn
          field="weight"
          label="Weight"
          testIDPrefix={testIDPrefix}
          value={draft.weight}
          maxValue={draft.weightMax}
          showRange={showRange}
          invalid={draft.weight.length > 0 && valueInvalid}
          rangeInvalid={getPlanRangeError('weight', draft.weight, draft.weightMax) !== undefined}
          textColor={highlightColor}
          outlineColor={highlightColor}
          autoFocus={autoFocusField === 'weight'}
          onChangeValue={(value) => updateField('weight', value)}
          onChangeMaxValue={(value) => updateField('weightMax', value)}
          onBlur={commitDraft}
        />
        <OneRmToggle
          testID={`${testIDPrefix}-1rm-toggle`}
          oneRepMax={oneRepMax}
          disabled1Rm={disable1RMWeightCalculation}
          onToggle={handleToggle1RM}
        />
        <IconButton testID={`${testIDPrefix}-delete`} icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
      </View>
      {rangeError !== undefined && (
        <HelperText type="error" visible testID={`${testIDPrefix}-range-error`} style={styles.rangeError}>
          {rangeError}
        </HelperText>
      )}
      {rangeError === undefined && valueError !== undefined && (
        <HelperText type="error" visible testID={`${testIDPrefix}-value-error`} style={styles.rangeError}>
          {valueError}
        </HelperText>
      )}
    </View>
  );
};

interface PendingPlanEditSetRowProps {
  pendingSet: PendingPlanSet;
  oneRepMax?: number;
  showRanges: boolean;
  onChange: (field: PlanDraftField, value: string) => void;
  onDelete: () => void;
}

// GH-263 Item 2: inline weight-suggestion pattern ported from AddWorkoutSet.tsx.
// GH-324: the pending row no longer auto-commits while the user types. The draft
// stays pending until the user leaves the edit flow ("Add Set" again or Done),
// so typing never converts the row under the user's finger. The 1RM toggle is
// always rendered (disabled when the exercise has no recorded 1RM).
const PendingPlanEditSetRow = ({pendingSet, oneRepMax, showRanges, onChange, onDelete}: PendingPlanEditSetRowProps) => {
  const theme = useTheme();
  // GH-406: a row prefilled from the previous set carries a weight the user
  // planned deliberately — the same reasoning that makes saved rows default to
  // "no auto-suggestion" above. Without this, the first keystroke in Reps would
  // immediately overwrite the carried weight with the 1RM suggestion. The toggle
  // stays available, and re-enabling it recomputes the suggestion as before.
  const [disable1RMWeightCalculation, setDisable1RMWeightCalculation] = useState(
    () => pendingSet.prefilledFromPreviousSet === true,
  );
  const lastSuggestedWeightRef = useRef<string | null>(null);

  // `ignoreDisabled` is for the toggle: it recomputes while the state update
  // that re-enables the suggestion is still in flight, so the captured
  // disable1RMWeightCalculation is necessarily the stale `true`.
  const setWeightSuggestionFromReps = (repsValue: string, rirValue: string, ignoreDisabled = false) => {
    if (oneRepMax === undefined || (disable1RMWeightCalculation && !ignoreDisabled)) {
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
    const nextDisabled = !disable1RMWeightCalculation;
    setDisable1RMWeightCalculation(nextDisabled);
    if (!nextDisabled) {
      // Re-enabling — recompute the suggestion from the current reps/rir.
      setWeightSuggestionFromReps(pendingSet.reps, pendingSet.rir, true);
    }
  };

  // Show weight highlight whenever the suggestion is active and not overridden.
  const weightIsStillSuggested =
    lastSuggestedWeightRef.current !== null && pendingSet.weight === lastSuggestedWeightRef.current;
  const showHighlight = !disable1RMWeightCalculation && oneRepMax !== undefined && weightIsStillSuggested;
  const highlightColor = showHighlight ? theme.colors.primary : undefined;

  const showRange = showRanges || hasPendingRange(pendingSet);
  const rangeError = getPlanDraftRangeError(pendingSet);

  return (
    <View>
      <View style={[styles.row, {backgroundColor: withAlpha(theme.colors.primary, 0.04)}]}>
        <View style={styles.dragHandle}>
          <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
        </View>
        <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{pendingSet.index}</Text>
        <PlanFieldColumn
          field="reps"
          label="Reps"
          testIDPrefix="plan-pending-set"
          value={pendingSet.reps}
          maxValue={pendingSet.repsMax}
          showRange={showRange}
          invalid={false}
          rangeInvalid={getPlanRangeError('reps', pendingSet.reps, pendingSet.repsMax) !== undefined}
          onChangeValue={handleRepsChange}
          onChangeMaxValue={(value) => onChange('repsMax', value.replace(',', '.'))}
        />
        <PlanFieldColumn
          field="rir"
          label="RIR"
          testIDPrefix="plan-pending-set"
          value={pendingSet.rir}
          maxValue={pendingSet.rirMax}
          showRange={showRange}
          invalid={false}
          rangeInvalid={getPlanRangeError('rir', pendingSet.rir, pendingSet.rirMax) !== undefined}
          onChangeValue={handleRirChange}
          onChangeMaxValue={(value) => onChange('rirMax', value.replace(',', '.'))}
        />
        <PlanFieldColumn
          field="weight"
          label="Weight"
          testIDPrefix="plan-pending-set"
          value={pendingSet.weight}
          maxValue={pendingSet.weightMax}
          showRange={showRange}
          invalid={false}
          rangeInvalid={getPlanRangeError('weight', pendingSet.weight, pendingSet.weightMax) !== undefined}
          textColor={highlightColor}
          outlineColor={highlightColor}
          // GH-436 usability walk: the 1RM suggestion lands in the field while the
          // user is still typing reps; tapping the field then put the caret at the
          // end, so "60" over a suggested "118" became "11860". Selecting the
          // suggestion on focus makes the first keystroke replace it.
          selectTextOnFocus={showHighlight}
          onChangeValue={handleWeightChange}
          onChangeMaxValue={(value) => onChange('weightMax', value.replace(',', '.'))}
        />
        <OneRmToggle
          testID="plan-pending-set-1rm-toggle"
          oneRepMax={oneRepMax}
          disabled1Rm={disable1RMWeightCalculation}
          onToggle={handleToggle1RM}
        />
        <IconButton testID="plan-pending-set-delete" icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
      </View>
      {rangeError !== undefined && (
        <HelperText type="error" visible testID="plan-pending-set-range-error" style={styles.rangeError}>
          {rangeError}
        </HelperText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
  },
  activeItem: {
    zIndex: 100,
    elevation: 4,
  },
  placeholder: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    marginHorizontal: SECTION_MARGIN,
    marginBottom: SECTION_MARGIN,
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
  fieldColumn: {
    flex: 1,
    marginHorizontal: 2,
  },
  maxInput: {
    marginTop: 4,
  },
  rangeError: {
    paddingLeft: 50,
  },
  rangeToggle: {
    height: 30,
    width: 34,
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
