import React, {useState} from 'react';
import {useAllLastWorkouts} from '../../../redux/Workout/use/useAllLastWorkouts';
import {useLastFinishedWorkout} from '../../../redux/Workout/use/useLastFinishedWorkout';
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
import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../../redux/rootReducer';
import VideoSelectionModal from '../../video/VideoSelectionModal';
import SetRow from './SetRow';

interface Props {
  exercise: Exercise;
  onSubmit: () => void;
  suggest?: boolean;
  trainingsId?: number;
  workout?: Workout;
  onSubmitSet?: (workoutSet: WorkoutSet) => void;
  date: Date;
  info?: React.ReactNode;
  linkVideoMode?: boolean;
  onDisableLinkVideoMode?: () => void;
  onLiveInputChange?: (input: {reps: number; rir: number; weight: number}) => void;
  oneRepMaxRef?: (oneRm: number) => void;
  allowRefinalizeWhenDone?: boolean;
}

const AddWorkout = ({exercise, onSubmit, suggest, trainingsId, workout, onSubmitSet, date, info, linkVideoMode, onDisableLinkVideoMode, onLiveInputChange, oneRepMaxRef, allowRefinalizeWhenDone}: Props) => {
  let unfinishedWorkout = useUnfinishedWorkout(exercise.id!!);
  unfinishedWorkout = workout ?? unfinishedWorkout;
  let workouts = useAllLastWorkouts(exercise, 1);
  // 1RM baseline must come from the most recent FINISHED workout, never the
  // in-progress one (GH-195 P1) — otherwise "vs last" drifts mid-session.
  let lastFinishedWorkout = useLastFinishedWorkout(exercise);
  let oneRepMax = lastFinishedWorkout ? oneRepMaxForWorkouts(lastFinishedWorkout) : 0;
  React.useEffect(() => {
    oneRepMaxRef?.(oneRepMax);
  }, [oneRepMax, oneRepMaxRef]);
  let theme = useTheme();
  let addWorkout = dispatchAddWorkout(exercise);
  let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout(exercise);
  let finalizeWorkout = dispatchFinalizeWorkout();
  let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
  let suggestedWorkout = dispatchSuggest();
  const [selectedSetForLink, setSelectedSetForLink] = useState<WorkoutSet | undefined>(undefined);
  const unfinishedWorkoutRef = React.useRef<Workout | undefined>(unfinishedWorkout);
  const dateRef = React.useRef(date);
  const exerciseIdRef = React.useRef(exercise.id);
  const trainingsIdRef = React.useRef(trainingsId);
  const onSubmitSetRef = React.useRef(onSubmitSet);
  const addWorkoutRef = React.useRef(addWorkout);
  const addOrUpdateSetInWorkoutRef = React.useRef(addOrUpdateSetInWorkout);
  const deleteSetFromWorkoutRef = React.useRef(deleteSetFromWorkout);

  unfinishedWorkoutRef.current = unfinishedWorkout;
  dateRef.current = date;
  exerciseIdRef.current = exercise.id;
  trainingsIdRef.current = trainingsId;
  onSubmitSetRef.current = onSubmitSet;
  addWorkoutRef.current = addWorkout;
  addOrUpdateSetInWorkoutRef.current = addOrUpdateSetInWorkout;
  deleteSetFromWorkoutRef.current = deleteSetFromWorkout;

  const linkedSetIndices = useSelector(
    (state: GlobalState) =>
      unfinishedWorkout?.id !== undefined
        ? state.videoAnalyses.allIds
            .map(id => state.videoAnalyses.byId[id])
            .filter(a => a.workoutId === unfinishedWorkout!.id && a.setIndex !== undefined)
            .map(a => a.setIndex as number)
        : [],
    shallowEqual,
  );

  const submitWorkoutSet = React.useCallback((workoutSet: WorkoutSet) => {
    onSubmitSetRef.current?.(workoutSet);
    const currentWorkout = unfinishedWorkoutRef.current;
    const exerciseId = exerciseIdRef.current;
    if (exerciseId === undefined) {
      return;
    }
    if (currentWorkout === undefined) {
      addWorkoutRef.current(
        {
          //TODO index should be set by reducer
          //TODO nextTrainingsID should be handled by dispatch
          sets: [{...workoutSet, index: workoutSet.index ?? 1}],
          notes: '',
          exerciseId: exerciseId,
          trainingsId: trainingsIdRef.current,
          start: dateRef.current,
        },
        trainingsIdRef.current,
      );
      return;
    }
    if (currentWorkout.id === undefined) {
      addWorkoutRef.current(
        {
          //TODO index should be set by reducer
          sets: [
            {
              ...workoutSet,
              index: workoutSet.index ?? currentWorkout.sets.map((it) => it.index!!).reduce((a, b) => Math.max(a, b)) + 1,
            },
          ],
          notes: '',
          exerciseId: exerciseId,
          trainingsId: trainingsIdRef.current,
          start: dateRef.current,
        },
        trainingsIdRef.current,
      );
      return;
    }
    addOrUpdateSetInWorkoutRef.current(workoutSet, currentWorkout);
  }, []);

  const deleteWorkoutSet = React.useCallback((workoutSet: WorkoutSet) => {
    const currentWorkout = unfinishedWorkoutRef.current;
    if (currentWorkout === undefined) {
      return;
    }
    deleteSetFromWorkoutRef.current(workoutSet, currentWorkout);
  }, []);

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
        <AddWorkoutSet onSubmit={submitWorkoutSet} oneRepMax={oneRepMax} date={date} onLiveInputChange={onLiveInputChange} />
        {unfinishedWorkout &&
          unfinishedWorkout.sets.map((workoutSet) => (
            <SetRow
              key={workoutSet.index}
              workoutSet={workoutSet}
              setId={workoutSet.index}
              reps={workoutSet.reps}
              weight={workoutSet.weight}
              rir={workoutSet.rir}
              isDone={workoutSet.date !== undefined}
              isCurrent={false}
              onSubmit={submitWorkoutSet}
              onDelete={deleteWorkoutSet}
              date={date}
            />
          ))}
      </View>
      {linkVideoMode && unfinishedWorkout && unfinishedWorkout.id !== undefined && unfinishedWorkout.sets.length > 0 && (
        <View style={styles.linkVideoSection}>
          <Text style={styles.linkVideoHint}>Tap a set to link a video:</Text>
          {unfinishedWorkout.sets.map(set => (
            <TouchableOpacity
              key={set.index}
              testID={`add-workout-link-set-${set.index}`}
              onPress={() => {
                setSelectedSetForLink(set);
                onDisableLinkVideoMode?.();
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
      {(!workout || workout.end === undefined || allowRefinalizeWhenDone) && (
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
