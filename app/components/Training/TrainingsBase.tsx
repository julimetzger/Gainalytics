import {StyleSheet, View} from 'react-native';
import {Button, Text, TextInput} from 'react-native-paper';
import React, {useCallback, useMemo, useState} from 'react';
import {dispatchSuggestBasedOnTrained} from '../../redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained';
import {dispatchSuggestBasedOnPlanned} from '../../redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {convertToInteger, convertToNumber, ensureFormat} from '../../utils/numberInput';
import {DEFAULT_SUGGESTION_PROGRESSION_PROFILE, SuggestionProgressionProfile} from '../../utils/AnalyseUtils';

interface TrainingsBaseProps {
  trainingsPlan: TrainingsPlan;
  trainingInMicro: number;
  micro: number;
}

const TrainingsBase = ({trainingsPlan, trainingInMicro, micro}: TrainingsBaseProps) => {
  const trainingsPlanId = trainingsPlan.id!!;
  const [rirDeltaInput, setRirDeltaInput] = useState(DEFAULT_SUGGESTION_PROGRESSION_PROFILE.rirDelta.toString());
  const [weightIncreasePercentInput, setWeightIncreasePercentInput] = useState(DEFAULT_SUGGESTION_PROGRESSION_PROFILE.weightIncreasePercent.toString());
  const progressionProfile = useMemo(
    () =>
      ({
        rirDelta: parseRirDelta(rirDeltaInput),
        weightIncreasePercent: parseWeightIncreasePercent(weightIncreasePercentInput),
      }) satisfies SuggestionProgressionProfile,
    [rirDeltaInput, weightIncreasePercentInput],
  );

  let suggestBasedOnTrained = dispatchSuggestBasedOnTrained(trainingsPlanId, trainingInMicro, micro, progressionProfile);
  let suggestBasedOnPlanned = dispatchSuggestBasedOnPlanned(trainingsPlanId, trainingInMicro, micro, progressionProfile);

  const handleRirDeltaChange = useCallback((value: string) => {
    setRirDeltaInput(ensureFormat(value));
  }, []);

  const handleWeightIncreasePercentChange = useCallback((value: string) => {
    setWeightIncreasePercentInput(ensureFormat(value));
  }, []);

  const handleSuggestBasedOnTrained = useCallback(() => {
    suggestBasedOnTrained?.(trainingsPlanId, micro, trainingInMicro);
  }, [micro, suggestBasedOnTrained, trainingInMicro, trainingsPlanId]);

  const handleSuggestBasedOnPlanned = useCallback(() => {
    suggestBasedOnPlanned?.(trainingsPlanId, micro, trainingInMicro);
  }, [micro, suggestBasedOnPlanned, trainingInMicro, trainingsPlanId]);

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Linear progression</Text>
      <View style={styles.inputsContainer}>
        <TextInput
          mode="outlined"
          label="RIR delta"
          value={rirDeltaInput}
          onChangeText={handleRirDeltaChange}
          keyboardType="numeric"
          style={styles.input}
          testID="training-suggest-rir-delta-input"
        />
        <TextInput
          mode="outlined"
          label="Weight increase %"
          value={weightIncreasePercentInput}
          onChangeText={handleWeightIncreasePercentChange}
          keyboardType="numeric"
          style={styles.input}
          testID="training-suggest-weight-increase-input"
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button disabled={suggestBasedOnTrained === undefined} onPress={handleSuggestBasedOnTrained} testID="training-suggest-last-training-button">
          Suggest based on last Training
        </Button>
        <Button disabled={suggestBasedOnPlanned === undefined} onPress={handleSuggestBasedOnPlanned} testID="training-suggest-last-planned-training-button">
          Suggest based on last planned Training
        </Button>
      </View>
    </View>
  );
};

function parseRirDelta(value: string) {
  const parsedValue = convertToInteger(value);
  return Number.isNaN(parsedValue) ? DEFAULT_SUGGESTION_PROGRESSION_PROFILE.rirDelta : parsedValue;
}

function parseWeightIncreasePercent(value: string) {
  const parsedValue = convertToNumber(value);
  return Number.isNaN(parsedValue) ? DEFAULT_SUGGESTION_PROGRESSION_PROFILE.weightIncreasePercent : parsedValue;
}

const styles = StyleSheet.create({
  container: {
    margin: 5,
    gap: 8,
  },

  inputsContainer: {
    flexDirection: 'row',
    gap: 8,
  },

  input: {
    flex: 1,
  },

  buttonContainer: {
    gap: 4,
  },
});

export default TrainingsBase;
