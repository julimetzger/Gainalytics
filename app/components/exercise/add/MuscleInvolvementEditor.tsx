import React, {useCallback, useMemo, useState} from 'react';
import {
  AccessibilityActionEvent,
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import {Text, TextInput, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';
import {useAvailableMuscles} from '../../../redux/settings/use/useMuscles';
import {sortMusclesByName} from '../../../utils/muscle-catalog';

interface MuscleInvolvementEditorProps {
  pairs: MusclePercentPair[];
  onChange: (pairs: MusclePercentPair[]) => void;
}

const ACCESSIBILITY_STEP = 5;

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

const parseInputToPercent = (raw: string): {percent: number; display: string} | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return {percent: 0, display: ''};
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return {percent: 0, display: '0'};
  if (n > 100) return {percent: 100, display: '100'};
  return {percent: n, display: trimmed};
};

const clampInt = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

interface MuscleRowProps {
  muscle: Muscles;
  current: number;
  trackColor: string;
  primaryColor: string;
  onSurfaceColor: string;
  outlineVariantColor: string;
  onSetPercent: (muscle: Muscles, percent: number) => void;
}

const MuscleRow = ({
  muscle,
  current,
  trackColor,
  primaryColor,
  onSurfaceColor,
  outlineVariantColor,
  onSetPercent,
}: MuscleRowProps) => {
  const [barWidth, setBarWidth] = useState(0);
  const fillWidth = `${Math.max(0, Math.min(100, current))}%` as const;
  const inputValue = current > 0 ? String(current) : '';

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const setFromTouch = useCallback(
    (e: GestureResponderEvent) => {
      if (barWidth <= 0) return;
      const x = e.nativeEvent.locationX;
      const percent = clampInt((x / barWidth) * 100);
      if (percent === current) return;
      onSetPercent(muscle, percent);
    },
    [barWidth, current, muscle, onSetPercent],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const action = event.nativeEvent.actionName;
      if (action === 'increment') {
        onSetPercent(muscle, Math.min(100, current + ACCESSIBILITY_STEP));
      } else if (action === 'decrement') {
        onSetPercent(muscle, Math.max(0, current - ACCESSIBILITY_STEP));
      }
    },
    [current, muscle, onSetPercent],
  );

  const handleTextChange = useCallback(
    (raw: string) => {
      const parsed = parseInputToPercent(raw);
      if (parsed === null) return;
      onSetPercent(muscle, parsed.percent);
    },
    [muscle, onSetPercent],
  );

  return (
    <View
      style={[styles.row, {borderBottomColor: outlineVariantColor}]}
      testID={`muscle-row-${muscle}`}
    >
      <Text
        variant="bodyMedium"
        style={[styles.muscleLabel, {color: onSurfaceColor}]}
        numberOfLines={1}
      >
        {muscle}
      </Text>
      <View
        style={[styles.barTrack, {backgroundColor: trackColor}]}
        testID={`muscle-bar-${muscle}`}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={setFromTouch}
        onResponderMove={setFromTouch}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${muscle} involvement`}
        accessibilityValue={{min: 0, max: 100, now: current}}
        accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <View
          pointerEvents="none"
          style={[
            styles.barFill,
            {
              width: fillWidth,
              backgroundColor: primaryColor,
            },
          ]}
          testID={`muscle-bar-fill-${muscle}`}
        />
      </View>
      <TextInput
        value={inputValue}
        onChangeText={handleTextChange}
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
};

const MuscleInvolvementEditor = ({pairs, onChange}: MuscleInvolvementEditorProps) => {
  const theme = useTheme();
  const trackColor = theme.colors.surfaceVariant;
  const available = useAvailableMuscles();
  // GH-523: the user's muscle list, alphabetical.
  const muscles = useMemo(() => sortMusclesByName(available), [available]);

  const setPercent = useCallback(
    (muscle: Muscles, percent: number) => {
      onChange(setPercentFor(pairs, muscle, percent));
    },
    [pairs, onChange],
  );

  return (
    <View style={styles.container} testID="muscle-involvement-editor">
      {muscles.map((muscle) => (
        <MuscleRow
          key={muscle}
          muscle={muscle}
          current={percentFor(pairs, muscle)}
          trackColor={trackColor}
          primaryColor={theme.colors.primary}
          onSurfaceColor={theme.colors.onSurface}
          outlineVariantColor={theme.colors.outlineVariant}
          onSetPercent={setPercent}
        />
      ))}
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
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    height: 16,
    borderRadius: 8,
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
