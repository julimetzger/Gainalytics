import React, {useMemo} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {buildRecordCards, RecordCardModel} from '../../../utils/RecordsAnalysis';

const mono = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

interface Props {
  recordWorkouts: Workout[];
  exercises: Exercise[];
}

const RecordCardItem = ({card, index}: {card: RecordCardModel; index: number}) => {
  const theme = useTheme();
  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;

  const background = card.isTop ? theme.colors.secondaryContainer : surfaceContainer;
  const textColor = card.isTop ? theme.colors.onSecondaryContainer : theme.colors.onSurface;
  const subColor = card.isTop ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;
  const deltaColor = card.delta !== undefined && card.delta < 0 ? theme.colors.error : theme.colors.primary;

  return (
    <View testID={`record-card-${index}`} style={[styles.card, {backgroundColor: background}]}>
      {card.isTop ? (
        <Text testID="record-card-top-label" style={[styles.topLabel, {color: textColor}]}>
          🏆 TOP PR THIS PERIOD
        </Text>
      ) : null}
      <View style={styles.cardRow}>
        <View style={styles.left}>
          <View style={styles.nameRow}>
            {card.groupColor ? <View style={[styles.dot, {backgroundColor: card.groupColor}]} /> : null}
            <Text numberOfLines={1} style={[styles.name, {color: textColor}]}>
              {card.exerciseName}
            </Text>
          </View>
          {card.setLine ? <Text style={[styles.setLine, {color: subColor, fontFamily: mono, opacity: card.isTop ? 0.85 : 1}]}>{card.setLine}</Text> : null}
          <Text style={[styles.meta, {color: subColor, opacity: card.isTop ? 0.85 : 1}]}>{card.group ? `${card.group} · ${card.dateLabel}` : card.dateLabel}</Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.oneRm, {color: textColor, fontFamily: mono}]}>
            {card.oneRm.toFixed(1)}
            <Text style={[styles.oneRmUnit, {color: subColor, fontFamily: mono}]}> kg</Text>
          </Text>
          {card.delta !== undefined && card.delta !== 0 ? (
            <Text style={[styles.delta, {color: deltaColor, fontFamily: mono}]}>
              {card.delta > 0 ? '+' : ''}
              {card.delta.toFixed(1)} kg
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const RecordCardList = ({recordWorkouts, exercises}: Props) => {
  const theme = useTheme();
  const cards = useMemo(() => buildRecordCards(recordWorkouts, exercises), [recordWorkouts, exercises]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, {color: theme.colors.onBackground}]}>Records in this range</Text>
        <Text testID="records-shown-count" style={[styles.headerCount, {color: theme.colors.onSurfaceVariant}]}>
          {cards.length} shown
        </Text>
      </View>
      {cards.length === 0 ? (
        <Text testID="records-list-empty" style={[styles.emptyHint, {color: theme.colors.onSurfaceVariant}]}>
          No records in this range yet.
        </Text>
      ) : (
        cards.map((card, index) => <RecordCardItem key={`${card.workoutId ?? 'w'}-${index}`} card={card} index={index} />)
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 12,
  },
  emptyHint: {
    fontStyle: 'italic',
    marginHorizontal: 10,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 14,
  },
  topLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
  },
  left: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  setLine: {
    fontSize: 13,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  oneRm: {
    fontSize: 26,
    fontWeight: '700',
  },
  oneRmUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  delta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default RecordCardList;
