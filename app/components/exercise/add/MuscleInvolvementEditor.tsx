import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';
import {ALL_MUSCLES_SORTED} from './muscle-involvement-utils';

const QUICK_PERCENTS = [25, 50, 75, 100] as const;

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

const MuscleInvolvementEditor = ({pairs, onChange}: MuscleInvolvementEditorProps) => {
  const theme = useTheme();
  const trackColor = theme.colors.surfaceVariant;

  return (
    <View style={styles.container} testID="muscle-involvement-editor">
      {ALL_MUSCLES_SORTED.map((muscle) => {
        const current = percentFor(pairs, muscle);
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
                    width: `${Math.max(0, Math.min(100, current))}%`,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                testID={`muscle-bar-fill-${muscle}`}
              />
            </View>
            <View style={styles.chipsRow}>
              {QUICK_PERCENTS.map((p) => {
                const isActive = current === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => onChange(setPercentFor(pairs, muscle, isActive ? 0 : p))}
                    style={[
                      styles.chip,
                      {
                        borderColor: theme.colors.outlineVariant,
                        backgroundColor: isActive ? theme.colors.primary : 'transparent',
                      },
                    ]}
                    testID={`muscle-chip-${muscle}-${p}`}
                  >
                    <Text
                      variant="labelSmall"
                      style={{color: isActive ? theme.colors.onPrimary : theme.colors.onSurface}}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
  chipsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  chip: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MuscleInvolvementEditor;
