import {Keyboard, StyleSheet, View} from 'react-native';
import {Button, IconButton, Text, TextInput, ToggleButton, Tooltip, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from 'react';
import Toast from 'react-native-toast-message';
import {repetitionWeightByOneRm} from '../../../utils/AnalyseUtils';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {convertToNumber, ensureFormat} from '../../../utils/numberInput';

interface AddWorkoutProps {
  onSubmit: (arg: WorkoutSet) => void;
  workoutSet?: WorkoutSet;
  oneRepMax?: number;
  onDelete?: (arg: WorkoutSet) => void;
  hasToSaveManually?: boolean;
  isPlanningMode?: boolean;
  date?: Date;
}

const AddWorkoutSet = ({onSubmit, workoutSet, oneRepMax, onDelete, hasToSaveManually = false, isPlanningMode = false, date}: AddWorkoutProps) => {
  let theme = useTheme();
  const [weight, setWeight] = useState(workoutSet?.weight?.toString() ?? '');
  const [rir, setRPE] = useState(workoutSet?.rir?.toString() ?? '0');
  const [reps, setReps] = useState(workoutSet?.reps?.toString() ?? '');
  const [editing, setEditing] = useState(hasToSaveManually);
  let appSettings = useSettings();
  const [disable1RMWeightCalculation, setDisable1RMWeightCalculation] = useState(appSettings.toggles?.disable1RMButton);
  const [highlightWeightSuggestion, setHighlightWeightSuggestion] = useState(false);
  const [weightEmpty, setWeightEmpty] = useState(false);
  const [rirEmpty, setRirEmpty] = useState(false);
  const [repsEmpty, setRepsEmpty] = useState(false);

  useEffect(() => {
    if (workoutSet !== undefined) {
      setWeight(workoutSet.weight?.toString() ?? '');
      setRPE(workoutSet.rir?.toString() ?? '0');
      setReps(workoutSet.reps?.toString() ?? '');
    }
  }, [workoutSet]);

  const setWeightOnChange = (value: string) => {
    setWeightEmpty(false);
    setDisable1RMWeightCalculation(true);
    setWeight(ensureFormat(value));
  };

  const setRIROnChange = (value: string) => {
    setRirEmpty(false);
    reps !== '' ? setWeightByOtherFields(convertToNumber(reps), convertToNumber(value)) : 0;
    setRPE(ensureFormat(value));
  };

  function setWeightByOtherFields(reps: number, rir: number) {
    if (isNaN(reps) || isNaN(rir)) {
      return;
    }
    if (oneRepMax !== undefined && !disable1RMWeightCalculation) {
      setWeightEmpty(false);
      let weight = repetitionWeightByOneRm(reps, rir, oneRepMax!!).toFixed(0);
      setWeight(weight.toString());
    }
  }

  const setRepsOnChange = (value: string) => {
    setRepsEmpty(false);
    rir === '' ? setWeightByOtherFields(convertToNumber(value), 0) : 0;
    rir !== '' ? setWeightByOtherFields(convertToNumber(value), convertToNumber(rir)) : 0;
    setReps(ensureFormat(value));
  };

  function setWeightSuggestions() {
    if (!disable1RMWeightCalculation) {
      setHighlightWeightSuggestion(true);
    }
  }

  function persisted() {
    return workoutSet?.date !== undefined;
  }

  function determineCheckmarkColor() {
    if (persisted() && !editing) {
      return '#558b2f'; // green
    } else {
      return theme.colors.primary;
    }
  }

  function submit() {
    if (weight === '' || reps === '' || rir === '') {
      weight === '' && setWeightEmpty(true);
      reps === '' && setRepsEmpty(true);
      rir === '' && setRirEmpty(true);
      return;
    }
    if (weight === NaN.toString() || reps === NaN.toString() || rir === NaN.toString()) {
      weight === NaN.toString() && setWeightEmpty(true);
      reps === NaN.toString() && setRepsEmpty(true);
      rir === NaN.toString() && setRirEmpty(true);
      return;
    }
    if (weight === undefined || reps === undefined || rir === undefined) {
      weight === undefined && setWeightEmpty(true);
      reps === undefined && setRepsEmpty(true);
      rir === undefined && setRirEmpty(true);
      return;
    }
    const repsNumber = convertToNumber(reps);
    onSubmit({
      index: workoutSet?.index,
      date: date ?? new Date(Date.now()),
      weight: convertToNumber(weight),
      reps: repsNumber,
      rir: Number.isNaN(convertToNumber(rir)) ? 0 : convertToNumber(rir),
    } as WorkoutSet);
    if (repsNumber > 20) {
      Toast.show({
        type: 'error',
        text1: 'Cardio detected!',
        text2: "This app can't be used to track cardio. Please use real weights! Next time the app catches you doing cardio, the app will be deinstalled.",
      });
    }
    setEditing(false);
  }

  function submitOnChangeIfAllowed() {
    if (persisted() && !hasToSaveManually) {
      submit();
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          mode="outlined"
          label="Reps"
          value={reps.toString()}
          testID="add-workout-set-reps-input"
          style={[styles.textInput, styles.inputField]}
          onChangeText={setRepsOnChange}
          keyboardType="numeric"
          onFocus={() => {
            setEditing(true);
            setWeightSuggestions();
          }}
          onBlur={() => {
            setHighlightWeightSuggestion(false);
            submitOnChangeIfAllowed();
          }}
          error={repsEmpty}
          selectTextOnFocus={true}
        />
        <TextInput
          mode="outlined"
          label="RIR"
          value={rir.toString()}
          testID="add-workout-set-rir-input"
          style={[styles.textInput, styles.inputField]}
          onChangeText={setRIROnChange}
          keyboardType="numeric"
          onFocus={() => {
            setEditing(true);
            setWeightSuggestions();
          }}
          onBlur={() => {
            setHighlightWeightSuggestion(false);
            submitOnChangeIfAllowed();
          }}
          error={rirEmpty}
          selectTextOnFocus={true}
        />
        <TextInput
          mode="outlined"
          label="Weight"
          value={weight.toString()}
          testID="add-workout-set-weight-input"
          style={[styles.textInput, styles.inputField]}
          onChangeText={setWeightOnChange}
          keyboardType="numeric"
          textColor={highlightWeightSuggestion && !disable1RMWeightCalculation && workoutSet === undefined ? theme.colors.primary : undefined}
          outlineColor={highlightWeightSuggestion && !disable1RMWeightCalculation && workoutSet === undefined ? theme.colors.primary : undefined}
          onFocus={() => {
            setEditing(true);
          }}
          onBlur={() => {
            submitOnChangeIfAllowed();
          }}
          error={weightEmpty}
          selectTextOnFocus={true}
        />
      </View>
      <View style={styles.buttonContainer}>
        {oneRepMax ? (
          <View style={styles.toggleContainer}>
            <Tooltip enterTouchDelay={300} title="Suggests weight based on your last 1 rep max">
              <ToggleButton
                icon={() => <Text>1RM</Text>}
                status={!disable1RMWeightCalculation ? 'checked' : 'unchecked'}
                onPress={() => {
                  setDisable1RMWeightCalculation((prevState) => !prevState);
                  setWeightByOtherFields(convertToNumber(reps), convertToNumber(rir));
                }}
              />
            </Tooltip>
          </View>
        ) : null}
        <View style={styles.actionButtons}>
          {!isPlanningMode && (
            <>
              {persisted() && !editing && <IconButton icon={'check'} iconColor={determineCheckmarkColor()} />}
              {persisted() && editing && (
                <IconButton
                  icon={'check-circle'}
                  iconColor={determineCheckmarkColor()}
                  onPress={() => {
                    submit();
                    Keyboard.dismiss();
                  }}
                />
              )}
              {!persisted() && workoutSet !== undefined && (
                <IconButton
                  icon={'check-circle'}
                  iconColor={determineCheckmarkColor()}
                  onPress={() => {
                    submit();
                    Keyboard.dismiss();
                  }}
                />
              )}
            </>
          )}
          {!persisted() && workoutSet === undefined && (
            <Button
              mode={'contained'}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              testID="add-workout-set-submit-button"
              onPress={() => {
                submit();
                Keyboard.dismiss();
              }}
            >
              {'Add'}
            </Button>
          )}
          {(persisted() || (!persisted() && workoutSet !== undefined)) && onDelete !== undefined && <IconButton icon={'delete'} onPress={() => onDelete(workoutSet!!)} />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Container-Layout
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 2,
  },

  // Input-Area
  inputContainer: {
    flex: 66,
    flexDirection: 'row',
  },

  textInput: {
    height: 35,
    alignSelf: 'center',
  },

  inputField: {
    flex: 1,
    marginHorizontal: 2,
  },

  // Button-Area
  buttonContainer: {
    flex: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  toggleContainer: {
    marginHorizontal: 5,
  },

  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default AddWorkoutSet;
