import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';

export type DayStatus = 'done' | 'today' | 'future';

export interface DayStripDay {
  trainingNum: number;
  label: string;
  status: DayStatus;
}

interface DayStripProps {
  days: DayStripDay[];
}

const DayStrip = ({days}: DayStripProps) => {
  const theme = useTheme();
  if (!days.length) return null;

  return (
    <View style={styles.row} testID="day-strip">
      {days.map(day => {
        const bg =
          day.status === 'done' ? theme.colors.primary : day.status === 'today' ? theme.colors.surface : theme.colors.surfaceVariant ?? theme.colors.elevation?.level1;
        const fg =
          day.status === 'done'
            ? theme.colors.onPrimary
            : day.status === 'today'
            ? theme.colors.primary
            : theme.colors.onSurfaceVariant;
        const border = day.status === 'today' ? theme.colors.primary : 'transparent';

        return (
          <View
            key={day.trainingNum}
            testID={`day-pill-${day.trainingNum}`}
            style={[
              styles.pill,
              {
                backgroundColor: bg,
                borderColor: border,
                borderWidth: day.status === 'today' ? 2 : 0,
              },
            ]}
          >
            <Text
              variant="labelSmall"
              style={[styles.label, {color: fg, fontWeight: day.status === 'today' ? '700' : '500'}]}
              numberOfLines={1}
            >
              {day.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: 6, marginVertical: 8},
  pill: {
    flex: 1,
    minWidth: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {textAlign: 'center'},
});

export default DayStrip;
