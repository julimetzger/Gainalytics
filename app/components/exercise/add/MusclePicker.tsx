import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {List, Text, TextInput} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';

interface MusclePickerProps {
  muscles: MusclePercentPair[];
  onChange: (muscles: MusclePercentPair[]) => void;
}

const ALL_MUSCLES = Object.values(Muscles).sort() as Muscles[];

const MusclePicker = ({muscles, onChange}: MusclePickerProps) => {
  const assignedMuscles = muscles.filter(m => m.muscle && (m.percent ?? 0) > 0);

  const [outerExpanded, setOuterExpanded] = useState(assignedMuscles.length > 0);
  const [expandedMuscles, setExpandedMuscles] = useState<Set<Muscles>>(
    new Set(assignedMuscles.map(m => m.muscle as Muscles)),
  );

  const getPercent = (muscle: Muscles): number | undefined => {
    const pair = muscles.find(m => m.muscle === muscle);
    return pair?.percent && pair.percent > 0 ? pair.percent : undefined;
  };

  const handlePercentChange = (muscle: Muscles, value: string) => {
    const parsed = parseInt(value, 10);
    const newMuscles = muscles.filter(m => m.muscle !== muscle);
    if (!isNaN(parsed) && parsed > 0) {
      newMuscles.push({muscle, percent: parsed});
    }
    onChange(newMuscles);
  };

  const toggleMuscleExpand = (muscle: Muscles) => {
    setExpandedMuscles(prev => {
      const next = new Set(prev);
      if (next.has(muscle)) {
        next.delete(muscle);
      } else {
        next.add(muscle);
      }
      return next;
    });
  };

  const totalPercent = muscles.reduce((sum, m) => sum + (m.percent ?? 0), 0);
  const assignedCount = assignedMuscles.length;
  const summary = assignedCount > 0 ? `${assignedCount} muscle${assignedCount !== 1 ? 's' : ''} assigned · ${totalPercent}%` : 'No muscles assigned';

  return (
    <List.Accordion
      testID="muscles-outer-accordion"
      title="Muscles"
      description={!outerExpanded ? summary : undefined}
      expanded={outerExpanded}
      onPress={() => setOuterExpanded(prev => !prev)}
      left={props => <List.Icon {...props} icon="arm-flex" />}>
      {ALL_MUSCLES.map(muscle => {
        const percent = getPercent(muscle);
        const isExpanded = expandedMuscles.has(muscle);

        return (
          <List.Accordion
            key={muscle}
            testID={`muscle-row-${muscle}`}
            title={muscle}
            description={!isExpanded && percent ? `${percent}%` : undefined}
            expanded={isExpanded}
            onPress={() => toggleMuscleExpand(muscle)}
            style={styles.innerAccordion}>
            <View style={styles.inputContainer}>
              <TextInput
                testID={`muscle-input-${muscle}`}
                keyboardType="numeric"
                inputMode="numeric"
                label="Percent"
                mode="outlined"
                dense
                right={<TextInput.Affix text="%" />}
                value={percent?.toString() ?? ''}
                onChangeText={value => handlePercentChange(muscle, value)}
                style={styles.percentInput}
              />
            </View>
          </List.Accordion>
        );
      })}
      <Text testID="muscles-total" style={styles.total}>
        Total: {totalPercent}%
      </Text>
    </List.Accordion>
  );
};

const styles = StyleSheet.create({
  innerAccordion: {
    paddingLeft: 16,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  percentInput: {
    width: 120,
  },
  total: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.6,
  },
});

export default MusclePicker;
