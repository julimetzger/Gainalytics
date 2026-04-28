import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip, Text, useTheme} from 'react-native-paper';
import OutsidePressHandler from 'react-native-outside-press';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {PlanField, QuickEditTarget} from './planTypes';
import PlanReadSetRow from './PlanReadSetRow';
import PlanQuickEditSetRow from './PlanQuickEditSetRow';

interface PlanReadListProps {
  exercise: Exercise;
  sets: WorkoutSet[];
  mode: 'read' | 'quickEdit';
  quickEditTarget: QuickEditTarget | null;
  quickEditDraft: string;
  quickEditInvalid: boolean;
  onCellPress: (setIndex: number, field: PlanField) => void;
  onQuickEditChange: (value: string) => void;
  onQuickEditSubmit: () => void;
  onQuickEditOutsidePress: () => void;
}

const PlanReadList = ({
  exercise,
  sets,
  mode,
  quickEditTarget,
  quickEditDraft,
  quickEditInvalid,
  onCellPress,
  onQuickEditChange,
  onQuickEditSubmit,
  onQuickEditOutsidePress,
}: PlanReadListProps) => {
  const theme = useTheme();
  const content = (
    <View style={[styles.section, {backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary}]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, {color: theme.colors.onSurface}]}>{exercise.name}</Text>
        <Chip compact style={styles.chip}>
          {`${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`}
        </Chip>
      </View>
      {sets.length === 0 ? (
        <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No planned sets yet.</Text>
      ) : (
        sets.map((workoutSet) => {
          const active = quickEditTarget?.exerciseId === exercise.id && quickEditTarget?.setIndex === workoutSet.index;
          const onRowLongPress = () => {
            // TODO: wire the plan-row action sheet here in the follow-up ticket.
          };

          if (mode === 'quickEdit' && active && quickEditTarget !== null) {
            return (
              <PlanQuickEditSetRow
                key={`quick-${workoutSet.index}`}
                workoutSet={workoutSet}
                activeField={quickEditTarget.field}
                draftValue={quickEditDraft}
                invalid={quickEditInvalid}
                onCellPress={(field) => onCellPress(workoutSet.index ?? 0, field)}
                onChangeText={onQuickEditChange}
                onSubmitEditing={onQuickEditSubmit}
                onRowLongPress={onRowLongPress}
              />
            );
          }

          return (
            <PlanReadSetRow
              key={`read-${workoutSet.index}`}
              workoutSet={workoutSet}
              onCellPress={(field) => onCellPress(workoutSet.index ?? 0, field)}
              onRowLongPress={onRowLongPress}
            />
          );
        })
      )}
    </View>
  );

  if (mode === 'quickEdit') {
    return <OutsidePressHandler onOutsidePress={onQuickEditOutsidePress}>{content}</OutsidePressHandler>;
  }

  return content;
};

const styles = StyleSheet.create({
  section: {
    borderLeftWidth: 2,
    borderRadius: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  chip: {
    minHeight: 28,
  },
  emptyText: {
    paddingHorizontal: 16,
    paddingTop: 4,
    fontSize: 13,
  },
});

export default PlanReadList;
