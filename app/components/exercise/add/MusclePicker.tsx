import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Chip, Searchbar, Text, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';

interface MusclePickerProps {
  muscles: MusclePercentPair[];
  onChange: (muscles: MusclePercentPair[]) => void;
}

const CHIP_VALUES = [25, 50, 75, 100] as const;

const MusclePicker = ({muscles, onChange}: MusclePickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();

  const allMuscles = Object.values(Muscles);
  const filtered = searchQuery.trim()
    ? allMuscles.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
    : allMuscles;

  const activeMap = new Map<Muscles, number>(
    muscles
      .filter(m => m.muscle != null && m.percent != null)
      .map(m => [m.muscle as Muscles, m.percent as number]),
  );

  const handleChipPress = (muscle: Muscles, value: number) => {
    const current = activeMap.get(muscle);
    if (current === value) {
      onChange(muscles.filter(m => m.muscle !== muscle));
    } else {
      const updated = muscles.filter(m => m.muscle !== muscle);
      onChange([...updated, {muscle, percent: value}]);
    }
  };

  const selected = muscles.filter(m => m.muscle != null && m.percent != null);
  const summaryText =
    selected.length === 0
      ? 'No muscles selected'
      : selected.map(m => `${m.muscle} ${m.percent}`).join(' · ') +
        ` · ${selected.length} selected`;

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.header}>
        Muscles
      </Text>
      <Text variant="bodySmall" style={styles.hint}>
        Tap 25 / 50 / 75 / 100 for each involved muscle.
      </Text>
      <Searchbar
        placeholder="Filter muscles..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
        testID="muscle-searchbar"
      />
      <ScrollView style={styles.list} testID="muscle-list">
        {filtered.map(muscle => {
          const activePercent = activeMap.get(muscle);
          const isAssigned = activePercent != null;
          return (
            <View key={muscle} style={styles.muscleRow} testID={`muscle-row-${muscle}`}>
              <View
                style={[
                  styles.colorBar,
                  {backgroundColor: isAssigned ? theme.colors.primary : 'transparent'},
                ]}
              />
              <Text style={styles.muscleName}>{muscle}</Text>
              <View style={styles.chipRow}>
                {CHIP_VALUES.map(val => {
                  const isActive = activePercent === val;
                  return (
                    <Chip
                      key={val}
                      mode={isActive ? 'flat' : 'outlined'}
                      style={isActive ? {backgroundColor: theme.colors.primary} : undefined}
                      textStyle={isActive ? {color: theme.colors.onPrimary} : undefined}
                      compact
                      onPress={() => handleChipPress(muscle, val)}
                      testID={`chip-${muscle}-${val}`}
                    >
                      {String(val)}
                    </Chip>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer} testID="muscle-summary-footer">
        <Text variant="bodySmall">{summaryText}</Text>
      </View>
    </View>
  );
};

export default MusclePicker;

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  header: {
    marginBottom: 2,
  },
  hint: {
    marginBottom: 8,
    opacity: 0.7,
  },
  searchbar: {
    marginBottom: 8,
    height: 40,
  },
  list: {
    maxHeight: 280,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 8,
    borderRadius: 2,
  },
  muscleName: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 4,
  },
  footer: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.15)',
    marginTop: 4,
  },
});
