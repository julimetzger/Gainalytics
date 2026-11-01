import {DatePickerInput} from 'react-native-paper-dates';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Modal, Portal} from 'react-native-paper';
import {StyleSheet, View} from 'react-native';
import {DatePickerModal} from './DatePickerModal';
import {NullableRange} from './NullableRange';
import type {Range} from './DateRangePicker';

interface DateRangeDialogProps {
  visible: boolean;
  range: Range;
  onDismiss: () => void;
  /** Called with the confirmed start and end (the end falls back to today after a single-day tap). */
  onSave: (startDate: Date, endDate: Date) => void;
}

/** GH-642: the custom range dialog (start/end inputs + calendar), shared by DateRangePicker and the Analyse filter panel. */
const DateRangeDialog = ({visible, range, onDismiss, onSave}: DateRangeDialogProps) => {
  const [uncompleteRange, setUncompleteRange] = useState<NullableRange>(new NullableRange(range.startDate, range.endDate));
  // true when the calendar has confirmed both start and end; false after a single-day tap.
  // Text-input edits do NOT change this flag so that a single-day tap always falls back to
  // today on Save, regardless of what the user types in the end input afterward.
  const calendarEndSelectedRef = useRef(true);

  useEffect(() => {
    if (visible) {
      setUncompleteRange(new NullableRange(range.startDate, range.endDate));
      // The confirmed range always has an end date, so mark it as selected.
      calendarEndSelectedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleCalendarChange = useCallback((newRange: NullableRange) => {
    calendarEndSelectedRef.current = !!newRange.endDate;
    setUncompleteRange(newRange);
  }, []);

  function onSubmit() {
    onDismiss();
    if (uncompleteRange.startDate) {
      // Use the calendar-selected end date only when the calendar confirmed it.
      // When the user tapped a single day (calendarEndSelectedRef = false), always
      // fall back to today — ignoring any value typed into the end text input.
      const endDate = calendarEndSelectedRef.current && uncompleteRange.endDate ? uncompleteRange.endDate : new Date();
      onSave(uncompleteRange.startDate, endDate);
    }
  }

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <View style={styles.modalContent}>
          <View style={styles.inputRow}>
            <View style={styles.cell}>
              <DatePickerInput testID="date-range-start-input" locale="en" withModal={false} value={uncompleteRange.startDate} onChange={(d) => (d ? setUncompleteRange((prev) => new NullableRange(d, prev.endDate)) : null)} inputMode="start" />
            </View>
            <View style={styles.cell}>
              <DatePickerInput testID="date-range-end-input" locale="en" withModal={false} value={uncompleteRange.endDate} onChange={(d) => (d ? setUncompleteRange((prev) => new NullableRange(prev.startDate, d)) : null)} inputMode="end" />
            </View>
            <View style={styles.cell}>
              <Button testID="date-range-save" mode="elevated" onPress={onSubmit}>
                Save
              </Button>
            </View>
          </View>
          <DatePickerModal date={uncompleteRange} onChange={handleCalendarChange} />
        </View>
      </Modal>
    </Portal>
  );
};

export default DateRangeDialog;

const styles = StyleSheet.create({
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
  inputRow: {
    flexDirection: 'row',
    display: 'flex',
    justifyContent: 'flex-start',
  },
  cell: {
    flex: 1,
  },
});
