import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {AccumulationMode} from '../../models/AccumulationMode';
import {TrainingLengthBucket, formatTrainingLength, formatTrainingLengthDate, getTrainingLengthBucketLabel} from '../../utils/training-length-analysis';

interface TrainingLengthBucketDetailsProps {
  accumulationMode: AccumulationMode;
  bucket: TrainingLengthBucket;
  trainingNameById: Record<number, string>;
}

const getTrainingName = (trainingId: number | undefined, trainingNameById: Record<number, string>) => {
  if (trainingId === undefined) {
    return 'Completed training';
  }

  return trainingNameById[trainingId] ?? `Training ${trainingId}`;
};

const TrainingLengthBucketDetails = ({accumulationMode, bucket, trainingNameById}: TrainingLengthBucketDetailsProps) => {
  const theme = useTheme();

  return (
    <Card style={styles.card} testID="training-length-selected-bucket">
      <Card.Title title={getTrainingLengthBucketLabel(bucket.startDate, accumulationMode)} />
      <Card.Content>
        <Text variant="titleMedium">Average duration</Text>
        <Text variant="headlineSmall">{formatTrainingLength(bucket.averageDurationMinutes)}</Text>
        <Text style={[styles.summary, {color: theme.colors.onSurfaceVariant}]}>
          {bucket.trainingCount} completed trainings · {formatTrainingLength(bucket.totalDurationMinutes)} total
        </Text>

        <View style={styles.list} testID="training-length-selected-trainings">
          {bucket.trainings.map((training, index) => (
            <View
              key={training.key}
              style={[
                styles.row,
                index < bucket.trainings.length - 1 && {
                  borderBottomColor: theme.colors.outline,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
              testID={`training-length-selected-training-${training.trainingId ?? index}`}
            >
              <View style={styles.meta}>
                <Text variant="bodyLarge">{getTrainingName(training.trainingId, trainingNameById)}</Text>
                <Text style={[styles.date, {color: theme.colors.onSurfaceVariant}]}>{formatTrainingLengthDate(training.start)}</Text>
              </View>
              <Text variant="bodyMedium">{formatTrainingLength(training.durationMinutes)}</Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  summary: {
    marginTop: 4,
  },
  list: {
    marginTop: 16,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  meta: {
    flex: 1,
    marginRight: 12,
  },
  date: {
    marginTop: 4,
  },
});

export default TrainingLengthBucketDetails;
