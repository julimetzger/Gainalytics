import React, {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {IconButton} from 'react-native-paper';
import {Range} from '../date/DateRangePicker';
import {canStepForward, stepRangeForward} from '../../../utils/filter-panel';
import SwipeStepArea from './SwipeStepArea';

interface RangeStepperProps {
  /** Without a range the arrows are hidden and only the tap remains. */
  range?: Range;
  setRange?: (range: Range) => void;
  onPress?: () => void;
  children: ReactNode;
  testID: string;
}

/**
 * GH-642: previous/next arrows around a swipeable area. Swiping left or the right
 * arrow shows the next period of the same length, but never past today.
 */
const RangeStepper = ({range, setRange, onPress, children, testID}: RangeStepperProps) => {
  const forwardEnabled = range !== undefined && canStepForward(range);
  const previous = range && setRange ? () => setRange(range.minusRange()) : undefined;
  const next = range && setRange && forwardEnabled ? () => setRange(stepRangeForward(range)) : undefined;

  return (
    <View style={styles.row}>
      {previous && <IconButton testID="filter-range-previous" icon="chevron-left" accessibilityLabel="Previous period" onPress={previous} style={styles.arrow} />}
      <SwipeStepArea testID={testID} onPrevious={previous} onNext={next} onPress={onPress} style={styles.area} accessibilityHint={range ? 'Swipe to change the period' : undefined}>
        {children}
      </SwipeStepArea>
      {range && setRange && <IconButton testID="filter-range-next" icon="chevron-right" accessibilityLabel="Next period" disabled={!forwardEnabled} onPress={next} style={styles.arrow} />}
    </View>
  );
};

export default RangeStepper;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  area: {
    flex: 1,
  },
  arrow: {
    margin: 0,
  },
});
