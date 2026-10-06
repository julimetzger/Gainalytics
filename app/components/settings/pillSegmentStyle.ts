import {StyleSheet} from 'react-native';
import type {MD3Theme} from 'react-native-paper';

/**
 * Turns the buttons of a `ToggleButton.Row` into one pill-shaped segmented
 * control: equal segments, a shared outline with thin dividers, fully rounded
 * outer ends, and a tinted fill on the selected segment (Material 3's
 * segmented-button look).
 *
 * `ToggleButton.Row` appends a child's own `style` after its first/middle/last
 * styles, so these only have to override what differs.
 */
export const pillSegmentStyle = (theme: MD3Theme, index: number, count: number, selected: boolean) => [
  styles.segment,
  {
    borderColor: theme.colors.outline,
    backgroundColor: selected ? theme.colors.secondaryContainer : 'transparent',
  },
  index === 0 && styles.first,
  index === count - 1 && styles.last,
];

/** Icon colour that matches the segment's fill. */
export const pillSegmentIconColor = (theme: MD3Theme, selected: boolean) =>
  selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;

const PILL_HEIGHT = 40;

const styles = StyleSheet.create({
  segment: {
    width: 56,
    height: PILL_HEIGHT,
    borderWidth: 1,
  },
  first: {
    borderTopLeftRadius: PILL_HEIGHT / 2,
    borderBottomLeftRadius: PILL_HEIGHT / 2,
  },
  last: {
    borderTopRightRadius: PILL_HEIGHT / 2,
    borderBottomRightRadius: PILL_HEIGHT / 2,
  },
});
