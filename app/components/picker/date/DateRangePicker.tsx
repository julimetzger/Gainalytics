import {DatePickerInput} from 'react-native-paper-dates';
import React, {useRef, useState} from 'react';
import {Button, Icon, Modal, Portal} from 'react-native-paper';
import {getDateStringFromDate} from '../../../utils/DateHelper';
import {StyleSheet, View} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {DatePickerModal} from './DatePickerModal';
import {NullableRange} from './NullableRange';

const DateRangePicker = ({range, setRange}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false);
  const [uncompleteRange, setUncompleteRange] = useState<NullableRange>(new NullableRange(range.startDate, range.endDate));

  let swipeableRef = useRef(null);
  let close = () => {
    setTimeout(() => {
      swipeableRef?.current?.close();
    }, 250);
  };

  function onSubmit() {
    setOpen(false);
    if (uncompleteRange.startDate && uncompleteRange.endDate) {
      setRange(new Range(uncompleteRange.startDate, uncompleteRange.endDate));
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
          <Button onPress={() => setOpen(true)} uppercase={false} mode="outlined" style={{display: 'flex', alignSelf: 'center'}}>
            {getDateStringFromDate(range.startDate) + ' to ' + getDateStringFromDate(range.endDate)}
          </Button>
        </Swipeable>
      </View>
      <Portal>
        <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={styles.modal}>
          <View style={styles.modalContent}>
            <View style={{flexDirection: 'row', display: 'flex', justifyContent: 'flex-start'}}>
              <View style={{flex: 1}}>
                <DatePickerInput locale="en" withModal={false} value={range.startDate} onChange={(d) => (d ? setUncompleteRange({...uncompleteRange, startDate: d}) : null)} inputMode="start" />
              </View>
              <View style={{flex: 1}}>
                <DatePickerInput locale="en" withModal={false} value={range.endDate} onChange={(d) => (d ? setUncompleteRange({...uncompleteRange, endDate: d}) : null)} inputMode="end" />
              </View>
              <View style={{flex: 1}}>
                <Button mode="elevated" onPress={onSubmit}>
                  Save
                </Button>
              </View>
            </View>
            <DatePickerModal date={uncompleteRange} onChange={setUncompleteRange} />
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
