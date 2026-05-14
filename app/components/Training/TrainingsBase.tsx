import {StyleSheet, View} from 'react-native';
import {Button, Text, TextInput} from 'react-native-paper';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {dispatchSuggestBasedOnTrained} from '../../redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained';
import {dispatchSuggestBasedOnPlanned} from '../../redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned';
import {dispatchSuggestBasedOnLastMesoTraining} from '../../redux/Training/dispatch/plan/dispatchSuggestBasedOnLastMesoTraining';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {convertToInteger, convertToNumber, ensureFormat} from '../../utils/numberInput';
import {DEFAULT_SUGGESTION_PROGRESSION_PROFILE, SuggestionProgressionProfile} from '../../utils/AnalyseUtils';

interface TrainingsBaseProps {
  trainingsPlan: TrainingsPlan;
  trainingInMicro: number;
  micro: number;
  onEnterPlanMode?: () => void;
}

const TrainingsBase = ({trainingsPlan, trainingInMicro, micro, onEnterPlanMode}: TrainingsBaseProps) => {
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
  let suggestBasedOnLastMeso = dispatchSuggestBasedOnLastMesoTraining(trainingsPlanId, trainingInMicro, micro, progressionProfile);

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

  const handleSuggestBasedOnLastMeso = useCallback(() => {
    suggestBasedOnLastMeso?.(trainingsPlanId, micro, trainingInMicro);
  }, [micro, suggestBasedOnLastMeso, trainingInMicro, trainingsPlanId]);

  // GH-240: when none of the suggestion paths are available for this micro,
  // we don't want the user staring at an empty suggestions screen. Auto-route
  // them into plan mode (the manual exercise picker / linear plan flow).
  // The guard is slot-aware because RangeSwiper reuses pane component
  // instances across micro/trainingInMicro slots — a plain boolean ref would
  // only fire once per mounted instance and miss subsequent empty slots.
  const noSuggestionsAvailable =
    suggestBasedOnTrained === undefined &&
    suggestBasedOnPlanned === undefined &&
    suggestBasedOnLastMeso === undefined;
  const autoEnteredSlotKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!noSuggestionsAvailable || onEnterPlanMode === undefined) {
      return;
    }
    const slotKey = `${trainingsPlanId}:${micro}:${trainingInMicro}`;
    if (autoEnteredSlotKeyRef.current === slotKey) {
      return;
    }
    autoEnteredSlotKeyRef.current = slotKey;
    onEnterPlanMode();
  }, [noSuggestionsAvailable, onEnterPlanMode, trainingsPlanId, micro, trainingInMicro]);

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
        <Button disabled={suggestBasedOnLastMeso === undefined} onPress={handleSuggestBasedOnLastMeso} testID="training-suggest-last-meso-button">
          Suggest based on last Meso
        </Button>
        {onEnterPlanMode !== undefined && (
          <Button
            mode="contained"
            icon="playlist-edit"
            onPress={onEnterPlanMode}
            testID="training-plan-mode-button"
            style={styles.planModeButton}
          >
            Plan new Training
          </Button>
        )}
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

  planModeButton: {
    marginBottom: 4,
    alignSelf: 'center',
  },
});

export default TrainingsBase;
