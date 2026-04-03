import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Chip, Dialog, Icon, Portal, Text, useTheme} from 'react-native-paper';
import {IDropdownData, MultiselectDropdown} from 'sharingan-rn-modal-dropdown';
import {useAlleExercises} from '../../../redux/Exercises/use/useAllExercises';

interface Props {
  exerciseId?: number;
  alternativeIds: number[];
  onChange: (alternativeIds: number[]) => void;
}

const ExerciseAlternativesField = ({exerciseId, alternativeIds, onChange}: Props) => {
  const theme = useTheme();
  const allExercises = useAlleExercises();
  const [visible, setVisible] = useState(false);

  const availableExercises = useMemo(
    () => allExercises.filter((exercise) => exercise.id !== undefined && exercise.id !== exerciseId),
    [allExercises, exerciseId],
  );

  const selectedExercises = useMemo(
    () => availableExercises.filter((exercise) => exercise.id !== undefined && alternativeIds.includes(exercise.id)),
    [alternativeIds, availableExercises],
  );

  const dropdownData = useMemo<IDropdownData[]>(
    () =>
      availableExercises.map((exercise) => ({
        label: exercise.name,
        value: exercise.id!!.toString(),
        avatarComponent: <Icon source="swap-horizontal" size={20} />,
      })),
    [availableExercises],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Alternatives</Text>
        <Button mode="outlined" compact testID="exercise-alternatives-open-button" onPress={() => setVisible(true)}>
          +
        </Button>
      </View>
      <View style={styles.chips}>
        {selectedExercises.length > 0 ? (
          selectedExercises.map((exercise) => (
            <Chip
              key={exercise.id}
              mode="outlined"
              onClose={() => onChange(alternativeIds.filter((alternativeId) => alternativeId !== exercise.id))}
              style={styles.chip}
            >
              {exercise.name}
            </Chip>
          ))
        ) : (
          <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No alternatives selected</Text>
        )}
      </View>
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Select Alternatives</Dialog.Title>
          <Dialog.Content>
            <MultiselectDropdown
              label="Alternatives"
              enableSearch
              hideChip
              multiline
              value={alternativeIds.map((alternativeId) => alternativeId.toString())}
              onChange={(values: string[]) => onChange(values.map((value: string) => parseInt(value, 10)))}
              searchInputTheme={{colors: {primary: theme.colors.primary}}}
              data={dropdownData}
              paperTheme={theme}
              disableSort={false}
              selectedItemViewStyle={{backgroundColor: theme.colors.primaryContainer, color: theme.colors.onPrimaryContainer}}
              primaryColor={theme.colors.primaryContainer}
              enableAvatar
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  emptyText: {
    fontStyle: 'italic',
  },
});

export default ExerciseAlternativesField;
