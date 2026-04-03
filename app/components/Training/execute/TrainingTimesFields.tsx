import React, {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import DatePicker from '../../picker/date/DatePicker';
import {formatTrainingLength} from '../../../utils/training-length-analysis';
import {getTrainingDurationMinutes, getTrainingTimeValidationError} from '../../../utils/training-times';

interface TrainingTimesFieldsProps {
  title?: string;
  start: Date | number;
  end: Date | number;
  onStartChange: (date: Date) => void;
  onEndChange: (date: Date) => void;
  testIDPrefix?: string;
}

const TrainingTimesFields = ({title, start, end, onStartChange, onEndChange, testIDPrefix}: TrainingTimesFieldsProps) => {
  const theme = useTheme();
  const validationError = useMemo(() => getTrainingTimeValidationError(start, end), [end, start]);
  const durationMinutes = useMemo(() => getTrainingDurationMinutes(start, end), [end, start]);

  return (
    <View>
      {title && <Text variant="titleMedium">{title}</Text>}
      <View style={styles.field}>
        <DatePicker date={start} setDate={onStartChange} mode="datetime" label="Start" testID={testIDPrefix ? `${testIDPrefix}-start` : undefined} />
      </View>
      <View style={styles.field}>
        <DatePicker date={end} setDate={onEndChange} mode="datetime" label="End" testID={testIDPrefix ? `${testIDPrefix}-end` : undefined} />
      </View>
      <Text style={styles.duration} testID={testIDPrefix ? `${testIDPrefix}-duration` : undefined}>
        Duration: {durationMinutes === null ? 'Invalid time range' : formatTrainingLength(durationMinutes)}
      </Text>
      {validationError && (
        <Text style={[styles.validationError, {color: theme.colors.error}]} testID={testIDPrefix ? `${testIDPrefix}-error` : undefined}>
          {validationError}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    marginTop: 12,
  },
  duration: {
    marginTop: 12,
  },
  validationError: {
    marginTop: 8,
  },
});

export default memo(TrainingTimesFields);
