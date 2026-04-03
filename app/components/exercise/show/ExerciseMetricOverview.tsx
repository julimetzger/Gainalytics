import React from 'react';
import {StyleSheet} from 'react-native';
import {Card, DataTable, Text} from 'react-native-paper';
import MetricView from '../../analyse/MetricComparison';
import {Comparison} from '../../analyse/MetricsOverviewForWorkouts';
import {Metric} from '../../../models/Metric';
import {Exercise} from '../../../models/entities/Exercise';

interface ExerciseMetricOverviewProps {
  exerciseMetricMap: Map<Exercise, Map<Metric, Comparison>>;
  metrics: Metric[];
  onMetricHeaderPress: (slotIndex: number) => void;
}

const ExerciseMetricOverview = ({exerciseMetricMap, metrics, onMetricHeaderPress}: ExerciseMetricOverviewProps) => {
  return (
    <Card style={styles.card}>
      <Card.Title title={<Text>Exercise Overview</Text>} />
      <Card.Content>
        <DataTable>
          <DataTable.Header>
            <DataTable.Title style={styles.flexL}>Exercise</DataTable.Title>
            {metrics.map((metric, index) => (
              <DataTable.Title key={`${metric}-${index}`} style={getMetricColumnStyle(index)} numeric onPress={() => onMetricHeaderPress(index)} testID={`metrics-exercises-header-${index}`}>
                <Text numberOfLines={2}>{metric}</Text>
              </DataTable.Title>
            ))}
          </DataTable.Header>
          {Array.from(exerciseMetricMap)
            .sort(([exerciseA], [exerciseB]) => exerciseA.name.localeCompare(exerciseB.name))
            .map(([exercise, workout]) => (
              <DataTable.Row key={exercise.id}>
                <DataTable.Cell style={styles.flexL}>
                  <Text>{exercise.name}</Text>
                </DataTable.Cell>
                {metrics.map((metric, index) => (
                  <DataTable.Cell key={`${exercise.id}-${metric}-${index}`} style={getMetricColumnStyle(index)} numeric>
                    <MetricView comparison={workout.get(metric)!!} />
                  </DataTable.Cell>
                ))}
              </DataTable.Row>
            ))}
        </DataTable>
      </Card.Content>
    </Card>
  );
};

const getMetricColumnStyle = (index: number) => {
  return index === 0 ? styles.flexM : styles.flexS;
};

const styles = StyleSheet.create({
  card: {
    margin: 5,
  },
  flexL: {
    flex: 10,
  },
  flexM: {
    flex: 7,
  },
  flexS: {
    flex: 6,
  },
});

export default ExerciseMetricOverview;
