import * as React from 'react';
import {Button, HelperText, Modal, Portal, Text, TextInput} from 'react-native-paper';
import {DatePickerInput} from 'react-native-paper-dates';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {getDateStringFromDate} from '../../../utils/DateHelper';
import {formatTrainingTimeInput, getTrainingTimeInputError, parseTrainingTimeInput} from '../../../utils/training-times';
import DatePickerModal from './DatePickerModal';

type DatePickerMode = 'date' | 'datetime';

interface DatePickerProps {
  date: Date | number;
  setDate: (arg: Date) => void;
  style?: StyleProp<ViewStyle>;
  mode?: DatePickerMode;
  label?: string;
  testID?: string;
  onErrorChange?: (error: string | null) => void;
}

const applySelectedDate = (currentDate: Date, selectedDate: Date) => {
  const nextDate = new Date(selectedDate);
  nextDate.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds(), currentDate.getMilliseconds());
  return nextDate;
};

const DatePicker = ({date, setDate, style, mode = 'date', label, testID, onErrorChange}: DatePickerProps) => {
  const resolvedDate = React.useMemo(() => new Date(date), [date]);
  const resolvedTimestamp = resolvedDate.getTime();
  const [open, setOpen] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState(resolvedDate);
  const [dateTimeValue, setDateTimeValue] = React.useState(() => formatTrainingTimeInput(resolvedDate));
  const [dateTimeError, setDateTimeError] = React.useState<string | null>(null);
  const [isDateTimeFocused, setIsDateTimeFocused] = React.useState(false);

  const updateDateTimeError = React.useCallback(
    (nextError: string | null) => {
      setDateTimeError(nextError);
      onErrorChange?.(nextError);
    },
    [onErrorChange],
  );

  React.useEffect(() => {
    if (open) {
      setDraftDate(new Date(resolvedDate));
    }
  }, [open, resolvedDate]);

  React.useEffect(() => {
    if (mode !== 'datetime') {
      return;
    }

    if (!isDateTimeFocused) {
      setDateTimeValue(formatTrainingTimeInput(resolvedDate));
    }

    updateDateTimeError(null);
  }, [isDateTimeFocused, mode, resolvedTimestamp, resolvedDate, updateDateTimeError]);

  const onDismissSingle = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleDateChange = React.useCallback((nextDate?: Date) => {
    if (!nextDate) {
      return;
    }

    setDraftDate((previousDate) => applySelectedDate(previousDate, nextDate));
  }, []);

  const handleSave = React.useCallback(() => {
    setDate(new Date(draftDate));
    setOpen(false);
  }, [draftDate, setDate]);

  const buttonLabel = React.useMemo(() => getDateStringFromDate(resolvedDate), [resolvedDate]);

  const handleDateTimeChange = React.useCallback(
    (nextValue: string) => {
      setDateTimeValue(nextValue);

      const nextError = getTrainingTimeInputError(nextValue, resolvedDate);
      updateDateTimeError(nextError);
      if (nextError) {
        return;
      }

      const parsedDate = parseTrainingTimeInput(nextValue, resolvedDate);
      if (parsedDate) {
        setDate(parsedDate);
      }
    },
    [resolvedDate, setDate, updateDateTimeError],
  );

  const handleDateTimeBlur = React.useCallback(() => {
    setIsDateTimeFocused(false);

    const parsedDate = parseTrainingTimeInput(dateTimeValue, resolvedDate);
    if (parsedDate) {
      setDateTimeValue(formatTrainingTimeInput(parsedDate));
    }
  }, [dateTimeValue, resolvedDate]);

  if (mode === 'datetime') {
    return (
      <View style={style}>
        <TextInput
          mode="outlined"
          label={label}
          value={dateTimeValue}
          onChangeText={handleDateTimeChange}
          onFocus={() => setIsDateTimeFocused(true)}
          onBlur={handleDateTimeBlur}
          placeholder="18:52 or 27/01/2026 18:52"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          error={!!dateTimeError}
          testID={testID}
        />
        <HelperText type="error" visible={!!dateTimeError}>
          {dateTimeError ?? ' '}
        </HelperText>
      </View>
    );
  }

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Button testID={testID} onPress={() => setOpen(true)} uppercase={false} mode="outlined" style={styles.button}>
        {buttonLabel}
      </Button>
      <Portal>
        <Modal visible={open} onDismiss={onDismissSingle} contentContainerStyle={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <View style={styles.headerInput}>
                <DatePickerInput locale="en" withModal={false} value={draftDate} onChange={handleDateChange} inputMode="start" />
              </View>
              <View style={styles.headerAction}>
                <Button mode="elevated" onPress={handleSave}>
                  Save
                </Button>
              </View>
            </View>
            {/* CalendarList scrolls itself; nested in a vertical ScrollView it rendered no months at all. */}
            <View style={styles.calendar}>
              <DatePickerModal date={draftDate} onChange={handleDateChange} />
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
  },
  button: {
    alignSelf: 'stretch',
  },
  modal: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 64,
  },
  modalContent: {
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  headerInput: {
    flex: 2,
  },
  headerAction: {
    flex: 1,
    justifyContent: 'center',
  },
  calendar: {
    flex: 1,
    paddingBottom: 32,
  },
});

export default DatePicker;
