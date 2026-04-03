import React, {memo, useEffect, useMemo, useState} from 'react';
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
  onValidationChange?: (error: string | null) => void;
}

const TrainingTimesFields = ({title, start, end, onStartChange, onEndChange, testIDPrefix, onValidationChange}: TrainingTimesFieldsProps) => {
  const theme = useTheme();
  const [startInputError, setStartInputError] = useState<string | null>(null);
  const [endInputError, setEndInputError] = useState<string | null>(null);
  const validationError = useMemo(() => startInputError ?? endInputError ?? getTrainingTimeValidationError(start, end), [end, endInputError, start, startInputError]);
  const durationMinutes = useMemo(() => (startInputError || endInputError ? null : getTrainingDurationMinutes(start, end)), [end, endInputError, start, startInputError]);

  useEffect(() => {
    onValidationChange?.(validationError);
  }, [onValidationChange, validationError]);

  return (
    <View>
      {title && <Text variant="titleMedium">{title}</Text>}
      <View style={styles.field}>
        <DatePicker
          date={start}
          setDate={onStartChange}
          mode="datetime"
          label="Start"
          testID={testIDPrefix ? `${testIDPrefix}-start` : undefined}
          onErrorChange={setStartInputError}
        />
      </View>
      <View style={styles.field}>
        <DatePicker
          date={end}
          setDate={onEndChange}
          mode="datetime"
          label="End"
          testID={testIDPrefix ? `${testIDPrefix}-end` : undefined}
          onErrorChange={setEndInputError}
        />
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
