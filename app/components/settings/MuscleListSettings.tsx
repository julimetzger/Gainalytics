import React, {memo, useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, HelperText, IconButton, List, Switch, Text, TextInput, useTheme} from 'react-native-paper';
import {Muscles} from '../../models/Muscles';
import {useAvailableMuscles, useOverviewMuscles} from '../../redux/settings/use/useMuscles';
import {dispatchAddMuscle, dispatchRemoveMuscle, dispatchSetMuscleInOverviews} from '../../redux/settings/dispatch/dispatchMuscles';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {countExercisesUsingMuscle, MAX_MUSCLE_NAME_LENGTH, normalizeMuscleName, validateMuscleName} from '../../utils/muscle-catalog';
import {ConfirmDialog} from '../common/EditDialogScaffold';

interface MuscleRowProps {
  muscle: Muscles;
  inOverviews: boolean;
  onToggle: (muscle: Muscles, visible: boolean) => void;
  onRemove: (muscle: Muscles) => void;
}

const MuscleRow = memo(({muscle, inOverviews, onToggle, onRemove}: MuscleRowProps) => (
  <View style={styles.row} testID={`settings-muscle-row-${muscle}`}>
    <Text style={styles.name} numberOfLines={1}>
      {muscle}
    </Text>
    <Switch value={inOverviews} onValueChange={(visible) => onToggle(muscle, visible)} accessibilityLabel={`Show ${muscle} in overviews`} testID={`settings-muscle-overview-${muscle}`} />
    <IconButton icon="delete-outline" accessibilityLabel={`Remove ${muscle}`} onPress={() => onRemove(muscle)} testID={`settings-muscle-remove-${muscle}`} />
  </View>
));

/**
 * GH-523: Settings → Muscles. Add your own muscles, remove ones you don't train,
 * and choose which muscles the overviews (muscle map, radar, Muscle Overview) show.
 */
const MuscleListSettings = () => {
  const theme = useTheme();
  const available = useAvailableMuscles();
  const overview = useOverviewMuscles();
  const exercises = useAlleExercises();
  const addMuscle = dispatchAddMuscle();
  const removeMuscle = dispatchRemoveMuscle();
  const setInOverviews = dispatchSetMuscleInOverviews();

  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingRemoval, setPendingRemoval] = useState<Muscles | undefined>(undefined);

  const sorted = useMemo(() => [...available].sort((a, b) => a.localeCompare(b)), [available]);
  const overviewSet = useMemo(() => new Set(overview), [overview]);
  const pendingCount = useMemo(() => (pendingRemoval ? countExercisesUsingMuscle(exercises, pendingRemoval) : 0), [exercises, pendingRemoval]);

  const handleAdd = useCallback(() => {
    const problem = validateMuscleName(name, available);
    setError(problem);
    if (problem) return;
    addMuscle(normalizeMuscleName(name));
    setName('');
  }, [name, available, addMuscle]);

  const handleChangeName = useCallback((text: string) => {
    setName(text);
    setError(undefined);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (pendingRemoval) removeMuscle(pendingRemoval);
    setPendingRemoval(undefined);
  }, [pendingRemoval, removeMuscle]);

  const removalMessage =
    pendingCount > 0
      ? `${pendingRemoval} is assigned to ${pendingCount} exercise${pendingCount === 1 ? '' : 's'}. Removing it also removes it from ${pendingCount === 1 ? 'that exercise' : 'those exercises'}.`
      : `${pendingRemoval} is not assigned to any exercise.`;

  return (
    <>
      <List.Accordion
        title="Manage muscles"
        description={`${available.length} muscles · ${overview.length} shown in overviews`}
        left={(props) => <List.Icon {...props} icon="arm-flex" />}
        expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
        testID="settings-muscles-accordion"
      >
        {/* One child with its own padding: the accordion would indent only some children. */}
        <View style={styles.body} testID="settings-muscles-body">
          <Text variant="bodySmall" style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}>
            The switch decides whether a muscle appears in the overviews (Muscle Map, Muscle Groups radar, Muscle Overview). Removing a muscle also removes it from your exercises.
          </Text>
          {sorted.map((muscle) => (
            <MuscleRow key={muscle} muscle={muscle} inOverviews={overviewSet.has(muscle)} onToggle={setInOverviews} onRemove={setPendingRemoval} />
          ))}
          <View style={styles.addRow}>
            <TextInput
              mode="outlined"
              dense
              label="New muscle"
              value={name}
              onChangeText={handleChangeName}
              onSubmitEditing={handleAdd}
              maxLength={MAX_MUSCLE_NAME_LENGTH + 8}
              error={error !== undefined}
              style={styles.input}
              testID="settings-muscle-name-input"
            />
            <Button mode="contained" icon="plus" onPress={handleAdd} testID="settings-muscle-add-button">
              Add
            </Button>
          </View>
          <HelperText type="error" visible={error !== undefined} testID="settings-muscle-error">
            {error}
          </HelperText>
        </View>
      </List.Accordion>
      <ConfirmDialog
        visible={pendingRemoval !== undefined}
        title={`Remove ${pendingRemoval ?? ''}?`}
        message={removalMessage}
        confirmLabel="Remove"
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingRemoval(undefined)}
        testID="settings-muscle-remove-dialog"
        confirmTestID="settings-muscle-remove-confirm"
        cancelTestID="settings-muscle-remove-cancel"
      />
    </>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingLeft: 0,
  },
  hint: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
  },
});

export default MuscleListSettings;
