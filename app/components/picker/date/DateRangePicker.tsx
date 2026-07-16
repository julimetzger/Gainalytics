import {DatePickerInput} from 'react-native-paper-dates';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Icon, Modal, Portal} from 'react-native-paper';
import {getDateStringFromDate} from '../../../utils/DateHelper';
import {StyleSheet, View} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {DatePickerModal} from './DatePickerModal';
import {NullableRange} from './NullableRange';

const DateRangePicker = ({range, setRange}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false);
  const [uncompleteRange, setUncompleteRange] = useState<NullableRange>(new NullableRange(range.startDate, range.endDate));
  // true when the calendar has confirmed both start and end; false after a single-day tap.
  // Text-input edits do NOT change this flag so that a single-day tap always falls back to
  // today on Save, regardless of what the user types in the end input afterward.
  const calendarEndSelectedRef = useRef(true);

  useEffect(() => {
    if (open) {
      setUncompleteRange(new NullableRange(range.startDate, range.endDate));
      // The confirmed range always has an end date, so mark it as selected.
      calendarEndSelectedRef.current = true;
    }
  }, [open]);

  const handleCalendarChange = useCallback((newRange: NullableRange) => {
    calendarEndSelectedRef.current = !!newRange.endDate;
    setUncompleteRange(newRange);
  }, []);

  let swipeableRef = useRef(null);
  let close = () => {
    setTimeout(() => {
      swipeableRef?.current?.close();
    }, 250);
  };

  function onSubmit() {
    setOpen(false);
    if (uncompleteRange.startDate) {
      // Use the calendar-selected end date only when the calendar confirmed it.
      // When the user tapped a single day (calendarEndSelectedRef = false), always
      // fall back to today — ignoring any value typed into the end text input.
      const endDate = calendarEndSelectedRef.current && uncompleteRange.endDate ? uncompleteRange.endDate : new Date();
      setRange(new Range(uncompleteRange.startDate, endDate));
    }
  }

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        <Swipeable
          ref={swipeableRef}
          onSwipeableOpen={(direction) => {
            if (direction === 'left') setRange(range.minusRange());
            if (direction === 'right') setRange(range.plusOneRange());
            close();
          }}
          dragOffsetFromLeftEdge={2}
          dragOffsetFromRightEdge={2}
          renderLeftActions={() => {
            return <Icon size={50} source={'chevron-left'} />;
          }}
          renderRightActions={() => {
            return <Icon size={50} source={'chevron-right'} />;
          }}
          overshootRight={false}
          overshootLeft={false}
        >
          <Button testID="date-range-picker-button" onPress={() => setOpen(true)} uppercase={false} mode="outlined" style={{display: 'flex', alignSelf: 'center'}}>
            {getDateStringFromDate(range.startDate) + ' to ' + getDateStringFromDate(range.endDate)}
          </Button>
        </Swipeable>
      </View>
      <Portal>
        <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={styles.modal}>
          <View style={styles.modalContent}>
            <View style={{flexDirection: 'row', display: 'flex', justifyContent: 'flex-start'}}>
              <View style={{flex: 1}}>
                <DatePickerInput testID="date-range-start-input" locale="en" withModal={false} value={uncompleteRange.startDate} onChange={(d) => (d ? setUncompleteRange((prev) => new NullableRange(d, prev.endDate)) : null)} inputMode="start" />
              </View>
              <View style={{flex: 1}}>
                <DatePickerInput testID="date-range-end-input" locale="en" withModal={false} value={uncompleteRange.endDate} onChange={(d) => (d ? setUncompleteRange((prev) => new NullableRange(prev.startDate, d)) : null)} inputMode="end" />
              </View>
              <View style={{flex: 1}}>
                <Button mode="elevated" onPress={onSubmit}>
                  Save
                </Button>
              </View>
            </View>
            <DatePickerModal date={uncompleteRange} onChange={handleCalendarChange} />
          </View>
        </Modal>
      </Portal>
    </>
  );
};

interface DateRangePickerProps {
  range: Range;
  setRange: (range: Range) => void;
}

export class Range {
  constructor(startDate: Date, endDate: Date) {
    this.startDate = new Date(startDate);
    if (endDate === undefined) {
      this.endDate = new Date(Date.now());
    } else {
      this.endDate = new Date(endDate);
    }
  }

  startDate: Date;
  endDate: Date;

  public plusOneRange(): Range {
    let startDateNew = this.startDate.getTime() + this.getRange();
    let endDateNew = this.endDate.getTime() + this.getRange();
    return new Range(new Date(startDateNew), new Date(endDateNew));
  }

  private getRange(): number {
    return this.endDate.getTime() - this.startDate.getTime() + 1000;
  }

  public minusRange(): Range {
    let startDateNew = this.startDate.getTime() - this.getRange();
    let endDateNew = this.endDate.getTime() - this.getRange();
    return new Range(new Date(startDateNew), new Date(endDateNew));
  }

  dateIsInRange(date: Date) {
    return new Date(date).getTime() > this.startDate.getTime() && new Date(date).getTime() < this.endDate.getTime();
  }
}

export default DateRangePicker;
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
});
