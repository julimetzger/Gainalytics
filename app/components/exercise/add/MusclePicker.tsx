import React, {useState} from 'react';
import {View, StyleSheet, ScrollView, useWindowDimensions} from 'react-native';
import {List, Text, TextInput} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';

interface MusclePickerProps {
  muscles: MusclePercentPair[];
  onChange: (muscles: MusclePercentPair[]) => void;
}

const ALL_MUSCLES = Object.values(Muscles).sort() as Muscles[];

const MusclePicker = ({muscles, onChange}: MusclePickerProps) => {
  const {height} = useWindowDimensions();
  const assignedMuscles = muscles.filter(m => m.muscle && (m.percent ?? 0) > 0);
  const [outerExpanded, setOuterExpanded] = useState(assignedMuscles.length > 0);

  const getPercent = (muscle: Muscles): string => {
    const pair = muscles.find(m => m.muscle === muscle);
    return pair?.percent && pair.percent > 0 ? pair.percent.toString() : '';
  };

  const handlePercentChange = (muscle: Muscles, value: string) => {
    const parsed = parseInt(value, 10);
    const newMuscles = muscles.filter(m => m.muscle !== muscle);
    if (!isNaN(parsed) && parsed > 0) {
      newMuscles.push({muscle, percent: parsed});
    }
    onChange(newMuscles);
  };

  const totalPercent = muscles.reduce((sum, m) => sum + (m.percent ?? 0), 0);
  const assignedCount = assignedMuscles.length;
  const summary =
    assignedCount > 0
      ? `${assignedCount} muscle${assignedCount !== 1 ? 's' : ''} assigned · ${totalPercent}%`
      : 'No muscles assigned';

  return (
    <List.Accordion
      testID="muscles-outer-accordion"
      title="Muscles"
      description={!outerExpanded ? summary : undefined}
      expanded={outerExpanded}
      onPress={() => setOuterExpanded(prev => !prev)}
      left={props => <List.Icon {...props} icon="arm-flex" />}>
      <ScrollView
        style={[styles.scrollList, {height: height * 0.45}]}
        nestedScrollEnabled>
        {ALL_MUSCLES.map(muscle => (
          <View key={muscle} testID={`muscle-row-${muscle}`} style={styles.muscleRow}>
            <Text style={styles.muscleName}>{muscle}</Text>
            <TextInput
              testID={`muscle-input-${muscle}`}
              keyboardType="numeric"
              inputMode="numeric"
              mode="outlined"
              dense
              right={<TextInput.Affix text="%" />}
              value={getPercent(muscle)}
              onChangeText={value => handlePercentChange(muscle, value)}
              style={styles.percentInput}
            />
          </View>
        ))}
      </ScrollView>
      <Text testID="muscles-total" style={styles.total}>
        Total: {totalPercent}%
      </Text>
    </List.Accordion>
  );
};

const styles = StyleSheet.create({
  scrollList: {},
  muscleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  muscleName: {
    flex: 1,
  },
  percentInput: {
    width: 80,
  },
  total: {
    opacity: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

export default MusclePicker;
