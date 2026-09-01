import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import {Card, Chip, FAB, Icon, Searchbar, Text, useTheme} from 'react-native-paper';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {Exercise} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';
import Sparkline from '../../components/exercise/show/Sparkline';
import {lastOneRm, oneRmHistoryValues, oneRmIncreaseDelta} from '../../components/exercise/show/exerciseStats';
import {exerciseMatchesGroup, MUSCLE_GROUPS, MuscleGroupKey, primaryMuscleTag} from '../../components/exercise/show/MuscleGroupFilters';
import {useExerciseWorkoutSummary} from '../../redux/Workout/use/useExerciseWorkoutSummary';
import {formatTimeAgo} from '../../components/exercise/show/formatTimeAgo';

const ExerciseTab = ({navigation}: Props) => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<MuscleGroupKey>('All');

  const exercises = useAlleExercises();

  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a: Exercise, b: Exercise) => {
      if (a.isFocus && !b.isFocus) return -1;
      if (!a.isFocus && b.isFocus) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedExercises.filter((ex) => {
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      const muscleList = (ex.muscles ?? []).map((m) => m.muscle).filter((m): m is Muscles => m != null);
      return exerciseMatchesGroup(muscleList, group);
    });
  }, [sortedExercises, search, group]);

  const focusExercises = useMemo(() => filteredExercises.filter((ex) => ex.isFocus), [filteredExercises]);
  const listExercises = filteredExercises;

  const goToDetail = (exercise: Exercise) => {
    navigation.navigate({
      name: 'AddWorkoutTab',
      params: {exercise},
    });
  };

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <Searchbar
        placeholder="Search exercises"
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        testID="exercise-searchbar"
      />
      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
          keyboardShouldPersistTaps="handled"
        >
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g}
              mode={group === g ? 'flat' : 'outlined'}
              selected={group === g}
              onPress={() => setGroup(g)}
              style={styles.filterChip}
              testID={`muscle-group-chip-${g}`}
              compact
            >
              {g}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {focusExercises.length > 0 && (
          <View>
            <Text variant="labelMedium" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
              FOCUS EXERCISES
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.focusRow} testID="focus-carousel">
              {focusExercises.map((ex) => (
                <FocusCard key={ex.id} exercise={ex} onPress={() => goToDetail(ex)} primaryColor={theme.colors.primary} />
              ))}
            </ScrollView>
          </View>
        )}

        <Text variant="labelMedium" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
          ALL EXERCISES
        </Text>
        <View testID="exercise-list">
          {listExercises.length === 0 ? (
            <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No exercises found</Text>
          ) : (
            listExercises.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                onPress={() => goToDetail(ex)}
                outlineColor={theme.colors.outlineVariant}
                surfaceVariantColor={theme.colors.surfaceVariant}
                onSurfaceColor={theme.colors.onSurface}
                onSurfaceVariantColor={theme.colors.onSurfaceVariant}
                primaryColor={theme.colors.primary}
              />
            ))
          )}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <FAB
        icon="plus"
        label="New Exercise"
        style={styles.fab}
        onPress={() =>
          navigation.navigate({
            name: 'EditExerciseSheet',
            params: {},
          })
        }
        testID="exercise-fab-new"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchbar: {
    margin: 8,
  },
  chipBar: {
    height: 44,
    justifyContent: 'center',
    marginBottom: 4,
  },
  chipScroll: {
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  filterChip: {
    marginRight: 6,
    height: 32,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  sectionLabel: {
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 4,
    letterSpacing: 1,
  },
  focusRow: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 8,
  },
  focusCard: {
    width: 180,
    marginHorizontal: 4,
  },
  focusCardContent: {
    paddingVertical: 12,
  },
  focusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  focusName: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  focusValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 4,
  },
  focusValue: {
    fontWeight: '700',
  },
  focusDeltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: 2,
  },
  sparklineWrap: {
    marginTop: 4,
    height: 36,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: {
    flex: 1,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowName: {
    fontSize: 16,
  },
  rowSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  rowTag: {
    marginRight: 4,
  },
  rowLastDone: {
    fontStyle: 'italic',
  },
  rowOneRm: {
    fontVariant: ['tabular-nums'],
    minWidth: 56,
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 96,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
});

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

interface FocusCardProps {
  exercise: Exercise;
  onPress: () => void;
  primaryColor: string;
}

const FocusCard = ({exercise, onPress, primaryColor}: FocusCardProps) => {
  const theme = useTheme();
  const oneRm = lastOneRm(exercise);
  const delta = oneRmIncreaseDelta(exercise);
  const history = oneRmHistoryValues(exercise);
  const oneRmText = typeof oneRm === 'number' && Number.isFinite(oneRm) ? `${oneRm.toFixed(1)} kg` : '— kg';
  const showDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  return (
    <Pressable onPress={onPress} testID={`focus-card-${exercise.id}`}>
      <Card mode="elevated" style={styles.focusCard}>
        <Card.Content style={styles.focusCardContent}>
          <View style={styles.focusCardHeader}>
            <Icon source="star" size={18} color="#FFB300" />
            <Text numberOfLines={1} style={[styles.focusName, {color: theme.colors.onSurface}]}>
              {exercise.name}
            </Text>
          </View>
          <View style={styles.focusValueRow}>
            <Text variant="headlineSmall" style={[styles.focusValue, {color: theme.colors.onSurface}]}>
              {oneRmText}
            </Text>
            {showDelta && (
              <View style={styles.focusDeltaPill} testID={`focus-card-delta-${exercise.id}`}>
                <Icon source={delta! > 0 ? 'arrow-up' : 'arrow-down'} size={12} color={delta! > 0 ? primaryColor : theme.colors.error} />
                <Text variant="labelSmall" style={{color: delta! > 0 ? primaryColor : theme.colors.error}}>
                  {delta! > 0 ? '+' : ''}{delta!.toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>
          <View style={styles.sparklineWrap}>
            <Sparkline values={Array.isArray(history) ? history : []} width={140} height={36} color={primaryColor} />
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
};

interface ExerciseRowProps {
  exercise: Exercise;
  onPress: () => void;
  outlineColor: string;
  surfaceVariantColor: string;
  onSurfaceColor: string;
  onSurfaceVariantColor: string;
  primaryColor: string;
}

const ExerciseRow = ({exercise, onPress, outlineColor, surfaceVariantColor, onSurfaceColor, onSurfaceVariantColor, primaryColor}: ExerciseRowProps) => {
  const muscleList = (exercise.muscles ?? []).map((m) => m.muscle).filter((m): m is Muscles => m != null);
  const tag = primaryMuscleTag(muscleList);
  const oneRm = lastOneRm(exercise);
  const history = oneRmHistoryValues(exercise);
  const summary = useExerciseWorkoutSummary(exercise.id);
  const lastDoneText =
    summary.lastWorkoutEnd instanceof Date && !Number.isNaN(summary.lastWorkoutEnd.getTime())
      ? formatTimeAgo(summary.lastWorkoutEnd)
      : '—';
  return (
    <Pressable
      onPress={onPress}
      testID={`exercise-row-${exercise.id}`}
      style={({pressed}) => [
        styles.row,
        {borderBottomColor: outlineColor},
        pressed && {backgroundColor: surfaceVariantColor},
      ]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowNameRow}>
          {exercise.isFocus && <Icon source="star" size={14} color="#FFB300" />}
          <Text style={[styles.rowName, {color: onSurfaceColor}]} numberOfLines={1}>
            {exercise.name}
          </Text>
        </View>
        <View style={styles.rowSubRow}>
          {tag && (
            <Text variant="bodySmall" style={[styles.rowTag, {color: onSurfaceVariantColor}]}>
              {tag}
            </Text>
          )}
          <Text
            variant="bodySmall"
            style={[styles.rowLastDone, {color: onSurfaceVariantColor}]}
            testID={`exercise-row-last-done-${exercise.id}`}
          >
            {lastDoneText}
          </Text>
        </View>
      </View>
      <Text style={[styles.rowOneRm, {color: onSurfaceColor}]}>
        {typeof oneRm === 'number' && Number.isFinite(oneRm) ? `${oneRm.toFixed(0)} kg` : '—'}
      </Text>
      <Sparkline values={history} width={56} height={20} color={primaryColor} />
    </Pressable>
  );
};

export default ExerciseTab;
