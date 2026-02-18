import {Card, DataTable, Text} from 'react-native-paper';
import MetricView from '../../analyse/MetricComparison';
import React from 'react';
import {Exercise} from '../../../models/entities/Exercise';
import {Comparison} from '../../analyse/MetricsOverviewForWorkouts';
import {StyleSheet} from 'react-native';
import {Metric} from "../../../models/Metric";

const ExerciseMetricOverview = ({exerciseMetricMap}: {exerciseMetricMap: Map<Exercise, Map<Metric, Comparison>>}) => {
  return (
    <Card style={{margin: 5}}>
      <Card.Title title={<Text>Exercise Overview</Text>}></Card.Title>
      <Card.Content>
        <DataTable>
          <DataTable.Header>
            <DataTable.Title style={styles.flexL}>Exercise</DataTable.Title>
            <DataTable.Title style={styles.flexM} numeric>
              1RM
            </DataTable.Title>
            <DataTable.Title style={styles.flexS} numeric>
              Reps
            </DataTable.Title>
            <DataTable.Title style={styles.flexS} numeric numberOfLines={2}>
              Max Intensity
            </DataTable.Title>
          </DataTable.Header>
          {Array.from(exerciseMetricMap)
            .sort(([exerciseA], [exerciseB]) => {
              return exerciseA.name.localeCompare(exerciseB.name);
            })
            .map(([exercise, workout]) => {
              return (
                <DataTable.Row key={exercise.id}>
                  <DataTable.Cell style={styles.flexL}>
                    <Text>{exercise.name}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.flexM} numeric>
                    <MetricView comparison={workout.get(Metric.ONE_RM)!!} />
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.flexS} numeric>
                    <MetricView comparison={workout.get(Metric.REPS)!!} />
                  </DataTable.Cell>
                  <DataTable.Cell style={styles.flexS} numeric>
                    <MetricView comparison={workout.get(Metric.MAX_INTENSITY)!!} />
                  </DataTable.Cell>
                </DataTable.Row>
              );
            })}
        </DataTable>
      </Card.Content>
    </Card>
  );
};

let styles = StyleSheet.create({
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
