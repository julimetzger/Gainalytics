import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Text, useTheme} from 'react-native-paper';

export type DayStatus = 'done' | 'today' | 'past' | 'future';

export interface DayStripDay {
  weekday: string;
  dayOfMonth: number;
  status: DayStatus;
  isoDate: string;
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
        const isDone = day.status === 'done';
        const isToday = day.status === 'today';
        const isMuted = day.status === 'past' || day.status === 'future';

        const weekdayColor = isMuted ? theme.colors.onSurfaceVariant : theme.colors.onSurface;
        const dayBg = isDone ? theme.colors.primary : 'transparent';
        const dayBorder = isToday ? theme.colors.primary : 'transparent';
        const dayFg = isDone ? theme.colors.onPrimary : isToday ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
          <View
            key={day.isoDate}
            testID={`day-pill-${day.isoDate}-${day.status}`}
            style={styles.dayCol}
          >
            <Text
              variant="labelSmall"
              style={[styles.weekdayLabel, {color: weekdayColor}]}
              numberOfLines={1}
            >
              {day.weekday}
            </Text>
            <View
              style={[
                styles.dayCircle,
                {
                  backgroundColor: dayBg,
                  borderColor: dayBorder,
                  borderWidth: isToday ? 2 : 0,
                },
              ]}
            >
              {isDone ? (
                <Icon source="check" size={18} color={dayFg} />
              ) : (
                <Text
                  variant="labelMedium"
                  style={[styles.dayLabel, {color: dayFg, fontWeight: isToday ? '700' : '500'}]}
                  numberOfLines={1}
                >
                  {day.dayOfMonth}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: 4, marginVertical: 8, justifyContent: 'space-between'},
  dayCol: {flex: 1, alignItems: 'center', gap: 4},
  weekdayLabel: {textAlign: 'center', fontSize: 11},
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {textAlign: 'center'},
});

export default DayStrip;
