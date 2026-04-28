import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import DraggableFlatList, {RenderItemParams, ScaleDecorator} from 'react-native-draggable-flatlist';
import {Chip, Icon, IconButton, Menu, Text, TextInput, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import DashedAddButton from '../../shared/DashedAddButton';
import {PendingPlanSet, PlanField} from './planTypes';
import {buildWorkoutSetFromDraft, getPlanSetDraft} from './planUtils';

interface PlanEditListProps {
  exercise: Exercise;
  exercises: Exercise[];
  sets: WorkoutSet[];
  pendingSet: PendingPlanSet | null;
  onAddSet: () => void;
  onPendingSetChange: (field: PlanField, value: string) => void;
  onPendingSetDelete: () => void;
  onDeleteSet: (workoutSet: WorkoutSet) => void;
  onUpsertSet: (workoutSet: WorkoutSet) => void;
  onReorderSets: (sets: WorkoutSet[]) => void;
  onRemoveExercise: (exercise: Exercise) => void;
}

type RowItem = {
  key: string;
  workoutSet: WorkoutSet;
};

const PlanEditList = ({
  exercise,
  exercises,
  sets,
  pendingSet,
  onAddSet,
  onPendingSetChange,
  onPendingSetDelete,
  onDeleteSet,
  onUpsertSet,
  onReorderSets,
  onRemoveExercise,
}: PlanEditListProps) => {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const data = useMemo<RowItem[]>(
    () =>
      sets.map((workoutSet) => ({
        key: `${workoutSet.index}-${workoutSet.weight}-${workoutSet.reps}-${workoutSet.rir}`,
        workoutSet,
      })),
    [sets],
  );

  return (
    <View style={[styles.section, {borderColor: withAlpha(theme.colors.primary, 0.18)}]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
          <Text style={[styles.title, {color: theme.colors.onSurface}]}>{exercise.name}</Text>
          <Chip compact style={styles.chip}>
            {`${sets.length + (pendingSet ? 1 : 0)} ${(sets.length + (pendingSet ? 1 : 0)) === 1 ? 'set' : 'sets'}`}
          </Chip>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<IconButton testID="plan-exercise-menu-button" icon="dots-vertical" iconColor={theme.colors.onSurfaceVariant} onPress={() => setMenuVisible(true)} />}
        >
          <Menu.Item
            testID="plan-remove-exercise"
            leadingIcon="delete-outline"
            title="Remove exercise"
            onPress={() => {
              setMenuVisible(false);
              onRemoveExercise(exercise);
            }}
          />
        </Menu>
      </View>
      <DraggableFlatList
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
          onChange={onPendingSetChange}
          onDelete={onPendingSetDelete}
          onCommit={onUpsertSet}
        />
      )}
      <DashedAddButton label="Add set" testID="plan-add-set-button" onPress={onAddSet} style={styles.addButton} />
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
  onChange: (field: PlanField, value: string) => void;
  onDelete: () => void;
  onCommit: (workoutSet: WorkoutSet) => void;
}

const PendingPlanEditSetRow = ({pendingSet, onChange, onDelete, onCommit}: PendingPlanEditSetRowProps) => {
  const theme = useTheme();

  useEffect(() => {
    const nextSet = buildWorkoutSetFromDraft(pendingSet, {index: pendingSet.index, date: new Date(), reps: 0, rir: 0, weight: 0});
    if (nextSet !== null) {
      onCommit(nextSet);
    }
  }, [onCommit, pendingSet]);

  return (
    <View style={[styles.row, {backgroundColor: withAlpha(theme.colors.primary, 0.04)}]}>
      <View style={styles.dragHandle}>
        <Icon source="drag-horizontal-variant" size={18} color={withAlpha(theme.colors.onSurfaceVariant, 0.6)} />
      </View>
      <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{pendingSet.index}</Text>
      <TextInput testID="plan-pending-set-reps-input" mode="outlined" dense keyboardType="numeric" label="Reps" value={pendingSet.reps} style={styles.input} onChangeText={(value) => onChange('reps', value.replace(',', '.'))} />
      <TextInput testID="plan-pending-set-rir-input" mode="outlined" dense keyboardType="numeric" label="RIR" value={pendingSet.rir} style={styles.input} onChangeText={(value) => onChange('rir', value.replace(',', '.'))} />
      <TextInput testID="plan-pending-set-weight-input" mode="outlined" dense keyboardType="numeric" label="Weight" value={pendingSet.weight} style={styles.input} onChangeText={(value) => onChange('weight', value.replace(',', '.'))} />
      <IconButton testID="plan-pending-set-delete" icon="delete-outline" iconColor={theme.colors.error} onPress={onDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontWeight: '600',
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
  addButton: {
    marginLeft: 28,
    marginRight: 16,
    marginTop: 8,
  },
});

export default PlanEditList;
