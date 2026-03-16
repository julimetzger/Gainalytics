import React, {memo, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Text, TextInput} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {Workout} from '../../models/entities/Workout';
import {GlobalState} from '../../redux/rootReducer';

interface Props {
  linkedWorkoutId?: number;
  linkedSetIndex?: number;
  onLink: (workoutId: number, exerciseId?: number, setIndex?: number) => void;
}

const VideoAnalysisWorkoutLinkCard = ({linkedWorkoutId, linkedSetIndex, onLink}: Props) => {
  const workouts = useSelector((state: GlobalState) => state.workouts.allIds.map((id) => state.workouts.byId[id]).filter((workout): workout is Workout => !!workout));
  const [workoutIdInput, setWorkoutIdInput] = useState(linkedWorkoutId?.toString() ?? '');
  const [setIndexInput, setSetIndexInput] = useState(linkedSetIndex !== undefined ? linkedSetIndex.toString() : '');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setWorkoutIdInput(linkedWorkoutId?.toString() ?? '');
  }, [linkedWorkoutId]);

  useEffect(() => {
    setSetIndexInput(linkedSetIndex !== undefined ? linkedSetIndex.toString() : '');
  }, [linkedSetIndex]);

  const latestWorkouts = useMemo(() => {
    return [...workouts]
      .filter((workout) => workout.id !== undefined)
      .sort((left, right) => (right.id ?? 0) - (left.id ?? 0))
      .slice(0, 8);
  }, [workouts]);

  const onLinkPress = () => {
    setError(undefined);
    const parsedWorkoutId = Number(workoutIdInput);
    if (!Number.isFinite(parsedWorkoutId)) {
      setError('Workout ID is required.');
      return;
    }

    const workout = workouts.find((entry) => entry.id === parsedWorkoutId);
    if (!workout) {
      setError('Workout not found.');
      return;
    }

    let parsedSetIndex: number | undefined = undefined;
    if (setIndexInput.trim().length > 0) {
      parsedSetIndex = Number(setIndexInput);
      if (!Number.isFinite(parsedSetIndex)) {
        setError('Set index must be numeric.');
        return;
      }

      const hasSetIndex = workout.sets.some((set) => set.index === parsedSetIndex);
      if (!hasSetIndex) {
        setError('Set index not found in selected workout.');
        return;
      }
    }

    onLink(parsedWorkoutId, workout.exerciseId, parsedSetIndex);
  };

  return (
    <Card style={styles.card}>
      <Card.Title title="Workout Linking" subtitle="Link this analysis to a workout and optional set" />
      <Card.Content>
        <TextInput
          testID="video-analysis-link-workout-id-input"
          mode="outlined"
          label="Workout ID"
          keyboardType="number-pad"
          value={workoutIdInput}
          onChangeText={setWorkoutIdInput}
          style={styles.input}
        />
        <TextInput
          testID="video-analysis-link-set-index-input"
          mode="outlined"
          label="Set Index (optional)"
          keyboardType="number-pad"
          value={setIndexInput}
          onChangeText={setSetIndexInput}
          style={styles.input}
        />
        <Button testID="video-analysis-link-save" mode="contained" onPress={onLinkPress}>
          Save Link
        </Button>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <View style={styles.linkInfo}>
          <Text>
            Current Link: workout {linkedWorkoutId ?? '-'}, set {linkedSetIndex ?? '-'}
          </Text>
          <Text style={styles.hintText}>Latest workouts: {latestWorkouts.map((workout) => workout.id).join(', ') || 'none'}</Text>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 10,
  },
  input: {
    marginBottom: 10,
  },
  errorText: {
    marginTop: 10,
  },
  linkInfo: {
    marginTop: 10,
  },
  hintText: {
    marginTop: 4,
  },
});

export default memo(VideoAnalysisWorkoutLinkCard);
