import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {NestableDraggableFlatList, RenderItemParams, ScaleDecorator} from 'react-native-draggable-flatlist';
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
  onSelectExercise: (exercise: Exercise) => void;
  onAddSet: (exerciseId: number) => void;
  onPendingSetChange: (exerciseId: number, field: PlanField, value: string) => void;
  onPendingSetDelete: (exerciseId: number) => void;
  onDeleteSet: (exerciseId: number, workoutSet: WorkoutSet) => void;
  onUpsertSet: (exerciseId: number, workoutSet: WorkoutSet) => void;
  onReorderSets: (exerciseId: number, sets: WorkoutSet[]) => void;
  onRemoveExercise: (exercise: Exercise) => void;
}

type RowItem = {
  key: string;
  workoutSet: WorkoutSet;
};

const sortSets = (sets: WorkoutSet[]) => [...sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

const PlanEditList = ({
  exercises,
  selectedExerciseId,
  plannedWorkoutsByExerciseId,
  pendingSetByExerciseId,
  onSelectExercise,
  onAddSet,
  onPendingSetChange,
  onPendingSetDelete,
  onDeleteSet,
  onUpsertSet,
  onReorderSets,
  onRemoveExercise,
}: PlanEditListProps) => {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {exercises.map((exercise) => {
        if (exercise.id === undefined) {
          return null;
        }
        const exerciseId = exercise.id;
        const sets = sortSets(plannedWorkoutsByExerciseId[exerciseId]?.sets ?? []);
        const pendingSet = pendingSetByExerciseId[exerciseId] ?? null;
        const selected = exerciseId === selectedExerciseId;

        return (
          <PlanEditExerciseSection
            key={`plan-edit-section-${exerciseId}`}
            exercise={exercise}
            selected={selected}
            sets={sets}
            pendingSet={pendingSet}
            onSelect={() => onSelectExercise(exercise)}
            onAddSet={() => onAddSet(exerciseId)}
            onPendingSetChange={(field, value) => onPendingSetChange(exerciseId, field, value)}
            onPendingSetDelete={() => onPendingSetDelete(exerciseId)}
            onDeleteSet={(workoutSet) => onDeleteSet(exerciseId, workoutSet)}
            onUpsertSet={(workoutSet) => onUpsertSet(exerciseId, workoutSet)}
            onReorderSets={(reorderedSets) => onReorderSets(exerciseId, reorderedSets)}
            onRemoveExercise={() => onRemoveExercise(exercise)}
            outlineColor={withAlpha(theme.colors.primary, 0.18)}
            primaryColor={theme.colors.primary}
          />
        );
      })}
    </View>
  );
};

interface SectionProps {
  exercise: Exercise;
  selected: boolean;
  sets: WorkoutSet[];
  pendingSet: PendingPlanSet | null;
  onSelect: () => void;
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
  sets,
  pendingSet,
  onSelect,
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

  return (
    <View
      testID={`plan-edit-exercise-section-${exercise.id}`}
      style={[
        styles.section,
        {borderColor: outlineColor},
        selected && {borderLeftColor: primaryColor, borderLeftWidth: 2},
      ]}
    >
      <Pressable onPress={onSelect} style={styles.headerRow} testID={`plan-edit-exercise-header-${exercise.id}`}>
        <View style={styles.headerTitleRow}>
          <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
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
      <NestableDraggableFlatList
        scrollEnabled={false}
        data={data}
        keyExtractor={(item) => item.key}
        renderItem={({item, drag, isActive}: RenderItemParams<RowItem>) => (
          <ScaleDecorator>
            <PlanEditSetRow
              workoutSet={item.workoutSet}
              onDelete={() => onDeleteSet(item.workoutSet)}
              onDrag={drag}
              onUpsert={onUpsertSet}
              active={isActive}
            />
          </ScaleDecorator>
        )}
        onDragEnd={({data: reorderedRows}) => {
          const reorderedSets = reorderedRows.map((row, index) => ({
            ...row.workoutSet,
            index: index + 1,
          }));
          onReorderSets(reorderedSets);
        }}
      />
      {pendingSet !== null && (
        <PendingPlanEditSetRow
          pendingSet={pendingSet}
          oneRepMax={oneRepMax > 0 ? oneRepMax : undefined}
          onChange={onPendingSetChange}
          onDelete={onPendingSetDelete}
          onCommit={onUpsertSet}
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

interface PlanEditSetRowProps {
  workoutSet: WorkoutSet;
  onDelete: () => void;
  onDrag: () => void;
  onUpsert: (workoutSet: WorkoutSet) => void;
  active: boolean;
}

const PlanEditSetRow = ({workoutSet, onDelete, onDrag, onUpsert, active}: PlanEditSetRowProps) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(() => getPlanSetDraft(workoutSet));

  useEffect(() => {
    setDraft(getPlanSetDraft(workoutSet));
  }, [workoutSet.index, workoutSet.reps, workoutSet.rir, workoutSet.weight]);

  return (
    <View style={[styles.row, active && {backgroundColor: theme.colors.secondaryContainer}]}>
      <Pressable testID={`plan-set-${workoutSet.index}-drag`} onLongPress={onDrag} style={styles.dragHandle}>
        <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
      </Pressable>
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
        onChangeText={(value) => updateField('weight', value)}
      />
      <IconButton testID={`plan-set-${workoutSet.index}-delete`} icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
    </View>
  );

  function updateField(field: PlanField, value: string) {
    const nextDraft = {
      ...draft,
      [field]: value.replace(',', '.'),
    };
    setDraft(nextDraft);
    const nextSet = buildWorkoutSetFromDraft(nextDraft, workoutSet);
    if (nextSet !== null) {
      onUpsert(nextSet);
    }
  }
};

interface PendingPlanEditSetRowProps {
  pendingSet: PendingPlanSet;
  oneRepMax?: number;
  onChange: (field: PlanField, value: string) => void;
  onDelete: () => void;
  onCommit: (workoutSet: WorkoutSet) => void;
}

// GH-263 Item 2: inline weight-suggestion pattern ported from AddWorkoutSet.tsx
// (L28-29, L70-86, L194-195). When the user has a known 1RM for this exercise
// and types reps or RIR, the weight TextInput auto-prefills with the computed
// weight using the same Brzycki/Epley formula AddWorkoutSet uses. The weight
// input is rendered with primary-color outline + text while the prefill is
// still the suggested default; once the user manually edits the weight, the
// highlight + auto-prefill drop. The 1RM toggle mirrors AddWorkoutSet's chip.
const PendingPlanEditSetRow = ({pendingSet, oneRepMax, onChange, onDelete, onCommit}: PendingPlanEditSetRowProps) => {
  const theme = useTheme();
  const [disable1RMWeightCalculation, setDisable1RMWeightCalculation] = useState(false);
  const [highlightWeightSuggestion, setHighlightWeightSuggestion] = useState(false);
  const lastSuggestedWeightRef = useRef<string | null>(null);

  useEffect(() => {
    const nextSet = buildWorkoutSetFromDraft(pendingSet, {index: pendingSet.index, date: new Date(), reps: 0, rir: 0, weight: 0});
    if (nextSet !== null) {
      onCommit(nextSet);
    }
  }, [onCommit, pendingSet]);

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

  // The weight field is "still the suggestion" if its current value matches
  // the last computed suggestion. Once the user changes it manually, the
  // values diverge and the highlight drops.
  const weightIsStillSuggested =
    lastSuggestedWeightRef.current !== null && pendingSet.weight === lastSuggestedWeightRef.current;
  const showHighlight =
    highlightWeightSuggestion && !disable1RMWeightCalculation && oneRepMax !== undefined && weightIsStillSuggested;
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
        onFocus={() => setHighlightWeightSuggestion(true)}
        onBlur={() => setHighlightWeightSuggestion(false)}
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
        onFocus={() => setHighlightWeightSuggestion(true)}
        onBlur={() => setHighlightWeightSuggestion(false)}
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
      {oneRepMax !== undefined && (
        <ToggleButton
          testID="plan-pending-set-1rm-toggle"
          icon={() => (
            <Text style={{color: disable1RMWeightCalculation ? theme.colors.onSurfaceDisabled : theme.colors.primary, fontSize: 11, fontWeight: '600'}}>1RM</Text>
          )}
          status={disable1RMWeightCalculation ? 'unchecked' : 'checked'}
          onPress={handleToggle1RM}
          style={styles.oneRmToggle}
          size={28}
        />
      )}
      <IconButton testID="plan-pending-set-delete" icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
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
