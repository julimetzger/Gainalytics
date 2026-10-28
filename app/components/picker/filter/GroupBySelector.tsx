import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Chip, SegmentedButtons} from 'react-native-paper';
import {Accumulation} from '../../../models/Accumulation';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {GROUP_BY_OPTIONS, GroupByOption, groupByOf} from '../../../utils/filter-panel';

interface GroupBySelectorProps {
  accumulation?: Accumulation;
  setAccumulation: (accumulation: Accumulation | undefined) => void;
  trainingsPlans: TrainingsPlan[];
}

/**
 * GH-642: Group by (the former accumulation mode) as a one-tap segment switch.
 * Micro needs a plan; with several plans a chip row picks it (the first is preselected).
 */
const GroupBySelector = ({accumulation, setAccumulation, trainingsPlans}: GroupBySelectorProps) => {
  const value = groupByOf(accumulation) ?? '';

  const select = (next: string) => {
    const option = GROUP_BY_OPTIONS.find((it) => it.value === (next as GroupByOption));
    if (!option || next === value) {
      return;
    }
    if (option.value === 'Micro') {
      if (trainingsPlans.length > 0) {
        setAccumulation(Accumulation.fromTrainingsPlan(trainingsPlans[0]));
      }
      return;
    }
    setAccumulation(new Accumulation(option.mode));
  };

  return (
    <>
      <SegmentedButtons
        density="small"
        value={value}
        onValueChange={select}
        buttons={GROUP_BY_OPTIONS.map((it) => ({
          value: it.value,
          label: it.value,
          testID: `filter-groupby-${it.value}`,
          disabled: it.value === 'Micro' && trainingsPlans.length === 0,
        }))}
      />
      {value === 'Micro' && trainingsPlans.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.plans} keyboardShouldPersistTaps="handled">
          {trainingsPlans.map((plan) => {
            const selected = accumulation?.trainingsPlan?.id === plan.id;
            return (
              <Chip key={plan.id} testID={`filter-groupby-plan-${plan.id}`} compact selected={selected} mode={selected ? 'flat' : 'outlined'} onPress={() => setAccumulation(Accumulation.fromTrainingsPlan(plan))}>
                {plan.name}
              </Chip>
            );
          })}
        </ScrollView>
      )}
    </>
  );
};

export default GroupBySelector;

const styles = StyleSheet.create({
  plans: {
    gap: 6,
    paddingTop: 8,
  },
});
