import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip} from 'react-native-paper';

export interface CompareChipOption<T extends string> {
  value: T;
  label: string;
  /** No reference exists yet (first micro, first training of a plan) — shown, but dead. */
  disabled?: boolean;
}

interface CompareChipsProps<T extends string> {
  options: CompareChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** testID of each chip: `<prefix>-<value>`. */
  testIDPrefix: string;
  children?: React.ReactNode;
}

/**
 * GH-526 — the reference picker of an Overview / analysis: one chip per
 * reference, exactly one selected. No "None" chip — the Total view of the
 * muscle map shows the own values anyway. `children` are rendered first in the
 * same wrapping row (the training analysis puts its Plan | Train toggle there).
 */
const CompareChips = <T extends string>({options, value, onChange, testIDPrefix, children}: CompareChipsProps<T>) => (
  <View style={styles.row}>
    {children}
    {options.map((option) => (
      <Chip
        key={option.value}
        testID={`${testIDPrefix}-${option.value}`}
        compact
        mode={option.value === value ? 'flat' : 'outlined'}
        selected={option.value === value}
        showSelectedCheck={false}
        disabled={option.disabled}
        accessibilityState={{selected: option.value === value, disabled: option.disabled}}
        onPress={() => onChange(option.value)}
      >
        {option.label}
      </Chip>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 8,
    marginTop: 4,
  },
});

export default CompareChips;
