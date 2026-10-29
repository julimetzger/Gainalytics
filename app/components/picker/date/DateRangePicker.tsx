import React, {useRef, useState} from 'react';
import {Button, Icon} from 'react-native-paper';
import {getDateStringFromDate} from '../../../utils/DateHelper';
import {View} from 'react-native';
// GH-588: react-native-gesture-handler 3 removed the legacy `Swipeable` export; importing it
// yielded `undefined` and crashed every screen with a range picker (Metrics Overview, History,
// Records, ...) into the Analyse error boundary.
import ReanimatedSwipeable, {SwipeableMethods, SwipeDirection} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {SharedValue, useAnimatedStyle} from 'react-native-reanimated';
import DateRangeDialog from './DateRangeDialog';

// The legacy Swipeable hid its actions while closed; ReanimatedSwipeable always draws them
// behind the row, and the outlined (transparent) button would show both chevrons at rest.
const SwipeAction = ({progress, source}: {progress: SharedValue<number>; source: string}) => {
  const style = useAnimatedStyle(() => ({opacity: progress.value > 0 ? 1 : 0}));
  return (
    <Animated.View style={style}>
      <Icon size={50} source={source} />
    </Animated.View>
  );
};

const DateRangePicker = ({range, setRange}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false);

  let swipeableRef = useRef<SwipeableMethods>(null);
  let close = () => {
    setTimeout(() => {
      swipeableRef?.current?.close();
    }, 250);
  };

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        <ReanimatedSwipeable
          ref={swipeableRef}
          onSwipeableOpen={(direction) => {
            // ReanimatedSwipeable names the drag direction: RIGHT reveals the left
            // actions (chevron-left, previous period) — the legacy 'left'.
            if (direction === SwipeDirection.RIGHT) setRange(range.minusRange());
            if (direction === SwipeDirection.LEFT) setRange(range.plusOneRange());
            close();
          }}
          dragOffsetFromLeft={2}
          dragOffsetFromRight={-2}
          renderLeftActions={(progress) => {
            return <SwipeAction progress={progress} source={'chevron-left'} />;
          }}
          renderRightActions={(progress) => {
            return <SwipeAction progress={progress} source={'chevron-right'} />;
          }}
          overshootRight={false}
          overshootLeft={false}
        >
          <Button testID="date-range-picker-button" onPress={() => setOpen(true)} uppercase={false} mode="outlined" style={{display: 'flex', alignSelf: 'center'}}>
            {getDateStringFromDate(range.startDate) + ' to ' + getDateStringFromDate(range.endDate)}
          </Button>
        </ReanimatedSwipeable>
      </View>
      <DateRangeDialog visible={open} range={range} onDismiss={() => setOpen(false)} onSave={(startDate, endDate) => setRange(new Range(startDate, endDate))} />
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
