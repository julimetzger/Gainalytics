import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {MuscleLaneModel} from '../../../utils/RecordsAnalysis';

const LANE_HEIGHT = 34;
const BAR_MAX_HEIGHT = 28;

interface Props {
  model: MuscleLaneModel;
}

const RecordsMuscleLanes = ({model}: Props) => {
  const theme = useTheme();

  if (model.lanes.length === 0) {
    return (
      <Text style={[styles.emptyHint, {color: theme.colors.onSurfaceVariant}]} testID="records-muscle-lanes-empty">
        No records in this range.
      </Text>
    );
  }

  return (
    <View testID="records-muscle-lanes">
      {model.lanes.map((lane) => {
        const laneMax = Math.max(1, ...lane.counts);
        return (
          <View key={lane.group} style={styles.lane}>
            <View style={styles.laneLegend}>
              <View style={[styles.dot, {backgroundColor: lane.color}]} />
              <Text numberOfLines={1} style={[styles.laneLabel, {color: theme.colors.onSurface}]}>
                {lane.group}
              </Text>
            </View>
            <View style={styles.bars}>
              {lane.counts.map((count, index) => (
                <View key={index} style={styles.barSlot}>
                  {count > 0 ? (
                    <View style={[styles.bar, {height: Math.max(4, (count / laneMax) * BAR_MAX_HEIGHT), backgroundColor: lane.color}]} />
                  ) : (
                    <View style={[styles.emptyTick, {backgroundColor: theme.colors.outlineVariant}]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
      <View style={styles.axis}>
        <View style={styles.laneLegend} />
        <View style={styles.bars}>
          {model.bucketLabels.map((label, index) => (
            <View key={index} style={styles.barSlot}>
              {label ? <Text style={[styles.axisLabel, {color: theme.colors.onSurfaceVariant}]}>{label}</Text> : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  lane: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: LANE_HEIGHT,
    marginBottom: 4,
  },
  laneLegend: {
    width: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  laneLabel: {
    fontSize: 13,
    flexShrink: 1,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    alignSelf: 'stretch',
    borderRadius: 3,
  },
  emptyTick: {
    alignSelf: 'stretch',
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
  },
  axis: {
    flexDirection: 'row',
    marginTop: 4,
  },
  axisLabel: {
    fontSize: 10,
    // Wider than the slot so 3-letter month names don't wrap; centered overflow.
    width: 30,
    textAlign: 'center',
  },
  emptyHint: {
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

export default RecordsMuscleLanes;
