import React from 'react';
import {useAllLastWorkouts} from '../../../redux/Workout/use/useAllLastWorkouts';
import {useUnfinishedWorkout} from '../../../redux/Workout/use/useUnfinishedWorkout';
import {Button, Text, useTheme} from 'react-native-paper';
import {dispatchAddWorkout} from '../../../redux/Workout/dispatch/dispatchAddWorkout';
import {dispatchAddOrUpdateSetInWorkout} from '../../../redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {dispatchFinalizeWorkout} from '../../../redux/Workout/dispatch/dispatchFinalizeWorkout';
import {dispatchDeleteSetFromWorkout} from '../../../redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchSuggest} from '../../../redux/Workout/dispatch/dispatchSuggest';
import {StyleSheet, View} from 'react-native';
import AddWorkoutSet from './AddWorkoutSet';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';
import {sameDate} from '../../../utils/DateHelper';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Workout} from '../../../models/entities/Workout';

interface Props {
  exercise: Exercise;
  onSubmit: () => void;
  suggest?: boolean;
  trainingsId?: number;
  workout?: Workout;
  onSubmitSet?: (workoutSet: WorkoutSet) => void;
  date: Date;
  info?: React.ReactNode;
}

const AddWorkout = ({exercise, onSubmit, suggest, trainingsId, workout, onSubmitSet, date, info}: Props) => {
  let unfinishedWorkout = useUnfinishedWorkout(exercise.id!!);
  unfinishedWorkout = workout ?? unfinishedWorkout;
  let workouts = useAllLastWorkouts(exercise, 1);
  let oneRepMax = oneRepMaxForWorkouts(...workouts);
  let theme = useTheme();
  let addWorkout = dispatchAddWorkout(exercise);
  let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout(exercise);
  let finalizeWorkout = dispatchFinalizeWorkout();
  let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
  let suggestedWorkout = dispatchSuggest();

  function submitWorkoutSet(workoutSet: WorkoutSet) {
    onSubmitSet ? onSubmitSet(workoutSet) : 0;
    if (unfinishedWorkout === undefined) {
      addWorkout(
        {
          //TODO index should be set by reducer
          //TODO nextTrainingsID should be handled by dispatch
          sets: [{...workoutSet, index: workoutSet.index ?? 1}],
          notes: '',
          exerciseId: exercise.id!!!,
          trainingsId: trainingsId,
          start: date,
        },
        trainingsId,
      );
      return;
    }
    if (unfinishedWorkout.id === undefined) {
      addWorkout(
        {
          //TODO index should be set by reducer
          sets: [
            {
              ...workoutSet,
              index: workoutSet.index ?? unfinishedWorkout!!.sets.map((it) => it.index!!).reduce((a, b) => Math.max(a, b)) + 1,
            },
          ],
          notes: '',
          exerciseId: exercise.id!!,
          trainingsId: trainingsId,
          start: date,
        },
        trainingsId,
      );
      return;
    }
    addOrUpdateSetInWorkout(workoutSet, unfinishedWorkout);
  }

  return (
    <View>
      <View style={[styles.header, info ? styles.headerWithInfo : null]}>
        {info && <View></View>}
        <Text style={styles.setText}> Set {unfinishedWorkout?.sets ? unfinishedWorkout.sets.length + 1 : 1}</Text>
        {info && info}
      </View>
      <View style={styles.contentContainer}>
        <AddWorkoutSet onSubmit={submitWorkoutSet} oneRepMax={oneRepMax} />
        {unfinishedWorkout &&
          unfinishedWorkout.sets.map((workoutSet) => {
            return <AddWorkoutSet key={workoutSet.index} workoutSet={workoutSet} onSubmit={submitWorkoutSet} onDelete={() => deleteSetFromWorkout(workoutSet, unfinishedWorkout!!)} />;
          })}
      </View>
      {(!workout || workout.end === undefined) && (
        <Button
          style={styles.addWorkoutButton}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          mode={'contained'}
          disabled={unfinishedWorkout === undefined || unfinishedWorkout.id === undefined}
          onPress={() => {
            finalizeWorkout(sameDate(date, new Date(Date.now())) ? new Date(Date.now()) : date, unfinishedWorkout?.id!!);
            onSubmit();
          }}
        >
          Add Workout
        </Button>
      )}
      {suggest && (
        <Button
          disabled={unfinishedWorkout !== undefined || workouts.length === 0}
          style={styles.suggestWorkout}
          onPress={() => {
            suggestedWorkout(exercise.id!!);
          }}
        >
          Suggest Workout
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Header-Area
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },

  headerWithInfo: {
    justifyContent: 'space-between',
    marginTop: 0,
  },

  setText: {
    alignSelf: 'center',
  },

  // Content-Area
  contentContainer: {
    display: 'flex',
    justifyContent: 'flex-start',
  },

  // Button-Area
  addWorkoutButton: {
    marginTop: 20,
    display: 'flex',
    alignSelf: 'center',
  },

  suggestWorkout: {
    position: 'relative',
    alignSelf: 'center',
    margin: 5,
  },
});

export default AddWorkout;
