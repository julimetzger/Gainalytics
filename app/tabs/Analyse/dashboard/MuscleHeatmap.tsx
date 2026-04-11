import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Chip, Text, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {Comparison} from '../../../components/analyse/MetricsOverviewForWorkouts';
import {Metric} from '../../../models/Metric';

interface MuscleHeatmapProps {
  muscleMetricMap: Map<Muscles, Map<Metric, Comparison>>;
  onMusclePress: (muscle: Muscles) => void;
}

const muscleChipColor = (comparison: Comparison | undefined, positiveColor: string, errorColor: string): string | undefined => {
  if (!comparison) return undefined;
  if (comparison.difference === undefined) return undefined;
  if (comparison.difference > 0) return positiveColor;
  if (comparison.difference < 0) return errorColor;
  return undefined;
};

const MuscleHeatmap = ({muscleMetricMap, onMusclePress}: MuscleHeatmapProps) => {
  const theme = useTheme();
  const allMuscles = Object.values(Muscles);

  return (
    <Card style={styles.card} testID="muscle-heatmap-card">
      <Card.Title title="Muskelgruppen" />
      <Card.Content>
        <View style={styles.chipContainer}>
          {allMuscles.map((muscle) => {
            const metrics = muscleMetricMap.get(muscle);
            const volumeComparison = metrics?.get(Metric.VOLUME);
            const chipColor = muscleChipColor(volumeComparison, theme.colors.primary, theme.colors.error);
            const hasData = volumeComparison !== undefined && volumeComparison.value > 0;

            return (
              <Chip
                key={muscle}
                style={[styles.chip, hasData && chipColor ? {backgroundColor: chipColor + '33'} : undefined]}
                textStyle={hasData && chipColor ? {color: chipColor} : {opacity: 0.5}}
                onPress={() => onMusclePress(muscle)}
                testID={`muscle-chip-${muscle}`}
              >
                {muscle}
              </Chip>
            );
          })}
        </View>
        <Text style={styles.hint}>Tippe auf eine Muskelgruppe für Details</Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    marginBottom: 2,
  },
  hint: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 8,
  },
});

export default MuscleHeatmap;
