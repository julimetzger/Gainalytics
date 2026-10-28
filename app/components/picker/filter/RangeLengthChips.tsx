import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip} from 'react-native-paper';
import {Range} from '../date/DateRangePicker';
import {presetOfRange, RANGE_PRESETS, rangeForPreset} from '../../../utils/filter-panel';

interface RangeLengthChipsProps {
  range: Range;
  setRange: (range: Range) => void;
  onCustom: () => void;
}

/** GH-642: 4W · 3M · 6M · 1Y jump to that length ending today; Custom opens the date dialog. */
const RangeLengthChips = ({range, setRange, onCustom}: RangeLengthChipsProps) => {
  const active = presetOfRange(range);
  return (
    <View style={styles.row}>
      {RANGE_PRESETS.map(({preset}) => (
        <Chip key={preset} testID={`filter-range-preset-${preset}`} compact selected={active === preset} showSelectedCheck={false} mode={active === preset ? 'flat' : 'outlined'} onPress={() => setRange(rangeForPreset(preset))} style={styles.chip}>
          {preset}
        </Chip>
      ))}
      <Chip testID="filter-range-preset-custom" compact icon="calendar" selected={active === undefined} showSelectedCheck={false} mode={active === undefined ? 'flat' : 'outlined'} onPress={onCustom} style={styles.chip}>
        Custom
      </Chip>
    </View>
  );
};

export default RangeLengthChips;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
  },
});
