import React, {useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import InstantSegmentedButtons from '../../common/InstantSegmentedButtons';

/**
 * Which data the analysis view renders. 'train' is the historical behaviour and
 * therefore the start position (GH-417 AC1).
 */
export type AnalysisDataMode = 'plan' | 'train';

interface AnalysisDataToggleProps {
  value: AnalysisDataMode;
  onChange: (mode: AnalysisDataMode) => void;
}

/**
 * GH-417: replaces the drawer's "Enable Planning Mode" and "Show muscle map"
 * switches. It only picks planned vs. actual data — it does NOT navigate and is
 * unrelated to the Plan | Train | Analysis sub-tab bar above it, which is why it
 * carries the "Show" caption.
 *
 * Built from Paper's SegmentedButtons like every other segmented control in the
 * app (see MicroOverviewTraining, TrainingLengthTab), so ripple feedback, theme
 * colours and the a11y "checked" state come from the framework instead of being
 * re-implemented. Each segment keeps its own testID, which Paper forwards to the
 * TouchableRipple — that is the node Maestro taps.
 */
const AnalysisDataToggle = ({value, onChange}: AnalysisDataToggleProps) => {
  const buttons = useMemo(
    () => [
      {
        value: 'plan',
        label: 'Plan',
        testID: 'analysis-data-plan',
        accessibilityLabel: 'Show Plan data',
      },
      {
        value: 'train',
        label: 'Train',
        testID: 'analysis-data-train',
        accessibilityLabel: 'Show Train data',
      },
    ],
    [],
  );

  const handleValueChange = useCallback((next: string) => onChange(next as AnalysisDataMode), [onChange]);

  // GH-526: sits at the start of the compare chip row, so it is compact and
  // carries no caption — the line below the chips names what is compared.
  return (
    <View style={styles.row} testID="analysis-data-toggle">
      <InstantSegmentedButtons style={styles.group} density="small" value={value} onValueChange={handleValueChange} buttons={buttons} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  group: {
    width: 156,
  },
});

export default AnalysisDataToggle;
