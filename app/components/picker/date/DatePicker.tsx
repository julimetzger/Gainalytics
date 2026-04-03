import * as React from 'react';
import {Button, Divider, Modal, Portal, Text} from 'react-native-paper';
import {DatePickerInput, TimePicker} from 'react-native-paper-dates';
import {ScrollView, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {getDateStringFromDate, getDateTimeStringFromDate} from '../../../utils/DateHelper';
import DatePickerModal from './DatePickerModal';

type DatePickerMode = 'date' | 'datetime';

interface DatePickerProps {
  date: Date | number;
  setDate: (arg: Date) => void;
  style?: StyleProp<ViewStyle>;
  mode?: DatePickerMode;
  label?: string;
  testID?: string;
}

const applySelectedDate = (currentDate: Date, selectedDate: Date) => {
  const nextDate = new Date(selectedDate);
  nextDate.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds(), currentDate.getMilliseconds());
  return nextDate;
};

const DatePicker = ({date, setDate, style, mode = 'date', label, testID}: DatePickerProps) => {
  const resolvedDate = React.useMemo(() => new Date(date), [date]);
  const [open, setOpen] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState(resolvedDate);
  const [focusedTimeInput, setFocusedTimeInput] = React.useState<'hours' | 'minutes'>('hours');

  React.useEffect(() => {
    if (open) {
      setDraftDate(new Date(resolvedDate));
      setFocusedTimeInput('hours');
    }
  }, [open, resolvedDate]);

  const onDismissSingle = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleDateChange = React.useCallback((nextDate?: Date) => {
    if (!nextDate) {
      return;
    }

    setDraftDate((previousDate) => applySelectedDate(previousDate, nextDate));
  }, []);

  const handleTimeChange = React.useCallback(({hours, minutes}: {hours: number; minutes: number}) => {
    setDraftDate((previousDate) => {
      const nextDate = new Date(previousDate);
      nextDate.setHours(hours, minutes, nextDate.getSeconds(), nextDate.getMilliseconds());
      return nextDate;
    });
  }, []);

  const handleSave = React.useCallback(() => {
    setDate(new Date(draftDate));
    setOpen(false);
  }, [draftDate, setDate]);

  const buttonLabel = React.useMemo(
    () => (mode === 'datetime' ? getDateTimeStringFromDate(resolvedDate) : getDateStringFromDate(resolvedDate)),
    [mode, resolvedDate],
  );

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
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <DatePickerModal date={draftDate} onChange={handleDateChange} />
              {mode === 'datetime' && (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="titleMedium" style={styles.timeTitle}>
                    Time
                  </Text>
                  <TimePicker
                    locale="en"
                    inputType="picker"
                    focused={focusedTimeInput}
                    onFocusInput={setFocusedTimeInput}
                    hours={draftDate.getHours()}
                    minutes={draftDate.getMinutes()}
                    onChange={handleTimeChange}
                    use24HourClock
                  />
                </>
              )}
            </ScrollView>
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
  scrollContent: {
    paddingBottom: 32,
  },
  divider: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  timeTitle: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});

export default DatePicker;
