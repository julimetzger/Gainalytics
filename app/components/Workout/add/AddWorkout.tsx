import React, {useState} from 'react';
import {useAllLastWorkouts} from '../../../redux/Workout/use/useAllLastWorkouts';
import {useUnfinishedWorkout} from '../../../redux/Workout/use/useUnfinishedWorkout';
import {Button, Icon, Text, useTheme} from 'react-native-paper';
import {dispatchAddWorkout} from '../../../redux/Workout/dispatch/dispatchAddWorkout';
import {dispatchAddOrUpdateSetInWorkout} from '../../../redux/Workout/dispatch/dispatchAddOrUpdateSetInWorkout';
import {dispatchFinalizeWorkout} from '../../../redux/Workout/dispatch/dispatchFinalizeWorkout';
import {dispatchDeleteSetFromWorkout} from '../../../redux/Workout/dispatch/dispatchDeleteSetFromWorkout';
import {dispatchSuggest} from '../../../redux/Workout/dispatch/dispatchSuggest';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import AddWorkoutSet from './AddWorkoutSet';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';
import {sameDate} from '../../../utils/DateHelper';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Workout} from '../../../models/entities/Workout';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../../redux/rootReducer';
import VideoSelectionModal from '../../video/VideoSelectionModal';

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
  const [linkVideoMode, setLinkVideoMode] = useState(false);
  const [selectedSetForLink, setSelectedSetForLink] = useState<WorkoutSet | undefined>(undefined);

  const linkedSetIndices = useSelector((state: GlobalState) =>
    unfinishedWorkout?.id !== undefined
      ? state.videoAnalyses.allIds
          .map(id => state.videoAnalyses.byId[id])
          .filter(a => a.workoutId === unfinishedWorkout!.id && a.setIndex !== undefined)
          .map(a => a.setIndex as number)
      : []
  );

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
      {selectedSetForLink !== undefined && unfinishedWorkout?.id !== undefined && (
        <VideoSelectionModal
          visible={true}
          onDismiss={() => setSelectedSetForLink(undefined)}
          workoutId={unfinishedWorkout.id}
          setIndex={selectedSetForLink.index ?? 0}
          exerciseId={exercise.id}
          onLinked={() => setSelectedSetForLink(undefined)}
        />
      )}
      <View style={[styles.header, info ? styles.headerWithInfo : null]}>
        {info && <View></View>}
        <Text style={styles.setText}> Set {unfinishedWorkout?.sets ? unfinishedWorkout.sets.length + 1 : 1}</Text>
        {info && info}
      </View>
      <View style={styles.contentContainer}>
        <AddWorkoutSet onSubmit={submitWorkoutSet} oneRepMax={oneRepMax} date={date} />
        {unfinishedWorkout &&
          unfinishedWorkout.sets.map((workoutSet) => {
            return <AddWorkoutSet key={workoutSet.index} workoutSet={workoutSet} onSubmit={submitWorkoutSet} onDelete={() => deleteSetFromWorkout(workoutSet, unfinishedWorkout!!)} date={date} />;
          })}
      </View>
      {unfinishedWorkout && unfinishedWorkout.id !== undefined && unfinishedWorkout.sets.length > 0 && (
        <View>
          <Button
            style={styles.linkVideoButton}
            mode="outlined"
            testID="add-workout-link-video-button"
            onPress={() => setLinkVideoMode(!linkVideoMode)}
          >
            {linkVideoMode ? 'Cancel Link Video' : 'Link Video'}
          </Button>
          {linkVideoMode && (
            <View style={styles.linkVideoSection}>
              <Text style={styles.linkVideoHint}>Tap a set to link a video:</Text>
              {unfinishedWorkout.sets.map(set => (
                <TouchableOpacity
                  key={set.index}
                  testID={`add-workout-link-set-${set.index}`}
                  onPress={() => {
                    setSelectedSetForLink(set);
                    setLinkVideoMode(false);
                  }}
                  style={styles.linkSetRow}
                >
                  <Text style={styles.linkSetText}>
                    Set {set.index}: {set.reps} reps × {set.weight} kg @ {set.rir} RIR
                  </Text>
                  {linkedSetIndices.includes(set.index ?? -1) ? (
                    <Icon source="video" size={16} color={theme.colors.secondary} />
                  ) : (
                    <Icon source="video-plus" size={16} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
      {(!workout || workout.end === undefined) && (
        <Button
          style={styles.addWorkoutButton}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          mode={'contained'}
          testID="add-workout-finalize-button"
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

  linkVideoButton: {
    marginTop: 10,
    alignSelf: 'center',
  },

  linkVideoSection: {
    marginTop: 8,
    marginHorizontal: 8,
  },

  linkVideoHint: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.7,
  },

  linkSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },

  linkSetText: {
    flex: 1,
  },
});

export default AddWorkout;
