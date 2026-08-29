import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';

/**
 * Which data the analysis view renders. 'train' is the historical behaviour and
 * therefore the start position (GH-417 AC1).
 */
export type AnalysisDataMode = 'plan' | 'train';

interface AnalysisDataToggleProps {
  value: AnalysisDataMode;
  onChange: (mode: AnalysisDataMode) => void;
}

const MODES: {id: AnalysisDataMode; label: string}[] = [
  {id: 'plan', label: 'Plan'},
  {id: 'train', label: 'Train'},
];

/**
 * GH-417: replaces the drawer's "Enable Planning Mode" and "Show muscle map"
 * switches. It only picks planned vs. actual data — it does NOT navigate and is
 * unrelated to the Plan | Train | Analysis sub-tab bar above it, which is why it
 * carries the "Show" caption.
 *
 * Plain Pressables rather than Paper's SegmentedButtons: those render their
 * touch target as an untagged ViewGroup, which neither UI tests nor Maestro can
 * address reliably (agent-memory #320).
 */
const AnalysisDataToggle = ({value, onChange}: AnalysisDataToggleProps) => {
  const theme = useTheme();
  const selectedBackground = (theme.colors as {secondaryContainer?: string}).secondaryContainer ?? 'rgba(0,0,0,0.08)';

  return (
    <View style={styles.row} testID="analysis-data-toggle">
      <Text style={[styles.caption, {color: theme.colors.onSurfaceVariant}]}>Show</Text>
      <View style={[styles.group, {borderColor: theme.colors.primary}]}>
        {MODES.map((mode) => {
          const selected = mode.id === value;
          return (
            <Pressable
              key={mode.id}
              testID={`analysis-data-${mode.id}`}
              accessibilityRole="button"
              accessibilityState={{selected}}
              accessibilityLabel={`Show ${mode.label} data`}
              onPress={() => onChange(mode.id)}
              style={[styles.segment, selected && {backgroundColor: selectedBackground}]}
            >
              <Text
                style={{
                  color: selected ? theme.colors.primary : theme.colors.onSurfaceVariant,
                  fontWeight: selected ? 'bold' : 'normal',
                }}
              >
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 8,
    gap: 8,
  },
  caption: {
    fontSize: 12,
  },
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnalysisDataToggle;
