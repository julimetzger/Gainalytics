import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, TextInput, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';
import {ALL_MUSCLES_SORTED} from './muscle-involvement-utils';

interface MuscleInvolvementEditorProps {
  pairs: MusclePercentPair[];
  onChange: (pairs: MusclePercentPair[]) => void;
}

const percentFor = (pairs: MusclePercentPair[], muscle: Muscles): number => {
  const found = pairs.find((p) => p.muscle === muscle);
  if (!found) return 0;
  const n = Number(found.percent);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const setPercentFor = (
  pairs: MusclePercentPair[],
  muscle: Muscles,
  percent: number,
): MusclePercentPair[] => {
  const others = pairs.filter((p) => p.muscle !== muscle);
  if (percent <= 0) return others;
  return [...others, {muscle, percent}];
};

// Accept digits and at most one '.', clamp to [0, 100]. Empty string clears the muscle.
const parseInputToPercent = (raw: string): {percent: number; display: string} | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return {percent: 0, display: ''};
  if (!/^\d*\.?\d*$/.test(trimmed)) return null; // ignore non-numeric character
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return {percent: 0, display: '0'};
  if (n > 100) return {percent: 100, display: '100'};
  return {percent: n, display: trimmed};
};

const MuscleInvolvementEditor = ({pairs, onChange}: MuscleInvolvementEditorProps) => {
  const theme = useTheme();
  const trackColor = theme.colors.surfaceVariant;

  return (
    <View style={styles.container} testID="muscle-involvement-editor">
      {ALL_MUSCLES_SORTED.map((muscle) => {
        const current = percentFor(pairs, muscle);
        const fillWidth = `${Math.max(0, Math.min(100, current))}%` as const;
        const inputValue = current > 0 ? String(current) : '';
        return (
          <View
            key={muscle}
            style={[styles.row, {borderBottomColor: theme.colors.outlineVariant}]}
            testID={`muscle-row-${muscle}`}
          >
            <Text
              variant="bodyMedium"
              style={[styles.muscleLabel, {color: theme.colors.onSurface}]}
              numberOfLines={1}
            >
              {muscle}
            </Text>
            <View style={[styles.barTrack, {backgroundColor: trackColor}]} testID={`muscle-bar-${muscle}`}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: fillWidth,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                testID={`muscle-bar-fill-${muscle}`}
              />
            </View>
            <TextInput
              value={inputValue}
              onChangeText={(raw) => {
                const parsed = parseInputToPercent(raw);
                if (parsed === null) return; // non-numeric → no-op
                onChange(setPercentFor(pairs, muscle, parsed.percent));
              }}
              keyboardType="numeric"
              mode="outlined"
              dense
              style={styles.input}
              contentStyle={styles.inputContent}
              testID={`muscle-input-${muscle}`}
              right={<TextInput.Affix text="%" />}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  muscleLabel: {
    width: 110,
    flexShrink: 0,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  input: {
    width: 72,
    height: 36,
  },
  inputContent: {
    paddingHorizontal: 4,
    fontSize: 14,
    textAlign: 'right',
  },
});

export default MuscleInvolvementEditor;
