import React, {useState} from 'react';
import {LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {SegmentedButtons, Tooltip, TouchableRipple, useTheme} from 'react-native-paper';

type SegmentedButtonsProps = React.ComponentProps<typeof SegmentedButtons>;
type SegmentedButton = SegmentedButtonsProps['buttons'][number];

export type TooltipSegmentedButton = SegmentedButton & {
  /** Shown in Paper's Tooltip while the segment is long-pressed. */
  tooltip: string;
};

type Props = Omit<SegmentedButtonsProps, 'buttons' | 'value' | 'onValueChange' | 'multiSelect'> & {
  value: string;
  onValueChange: (value: string) => void;
  buttons: TooltipSegmentedButton[];
};

/**
 * Paper's single-select SegmentedButtons whose segments explain themselves with
 * Paper's Tooltip on a long press — the info used everywhere else in the app.
 *
 * SegmentedButtons accepts no `onLongPress` and gives Tooltip no child to wrap,
 * so a transparent row of Tooltip-wrapped ripples lies on top of the segments
 * and takes their touches: a tap selects like the segment itself, a long press
 * shows the tooltip. The overlay is hidden from accessibility, so screen
 * readers and tests still see Paper's own segments with their testIDs and
 * checked state.
 */
const TooltipSegmentedButtons = ({buttons, value, onValueChange, style, ...rest}: Props) => {
  const theme = useTheme();
  const [height, setHeight] = useState(0);
  // Paper rounds the outer ends of a MD3 segmented control by 5 × roundness.
  const radius = 5 * theme.roundness;

  return (
    <View style={style} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      <SegmentedButtons
        {...rest}
        value={value}
        onValueChange={onValueChange}
        buttons={buttons.map(({tooltip: _tooltip, ...button}) => button)}
      />
      <View style={styles.overlay} importantForAccessibility="no-hide-descendants">
        {buttons.map((button, index) => (
          <View
            key={button.value}
            style={[
              styles.cell,
              index === 0 && {borderTopLeftRadius: radius, borderBottomLeftRadius: radius},
              index === buttons.length - 1 && {borderTopRightRadius: radius, borderBottomRightRadius: radius},
            ]}
          >
            <Tooltip title={button.tooltip}>
              <TouchableRipple
                testID={button.testID ? `${button.testID}-touch` : undefined}
                accessible={false}
                disabled={button.disabled}
                style={{height}}
                onPress={(e) => {
                  button.onPress?.(e);
                  onValueChange(button.value);
                }}
              >
                <View />
              </TouchableRipple>
            </Tooltip>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    overflow: 'hidden',
  },
});

export default TooltipSegmentedButtons;
