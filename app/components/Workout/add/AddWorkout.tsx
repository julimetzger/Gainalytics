import React, {useState} from 'react';
import {useAllLastWorkouts} from '../../../redux/Workout/use/useAllLastWorkouts';
import {useLastFinishedWorkout} from '../../../redux/Workout/use/useLastFinishedWorkout';
import {usePersistedUnfinishedWorkout, useUnfinishedWorkout} from '../../../redux/Workout/use/useUnfinishedWorkout';
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

/**
 * GH-443: what the submit actually did to the log. The same handler serves the
 * new-set input and every already-logged row (a row re-submits itself on blur),
 * so a caller that only sees the set cannot tell a freshly logged set from a
 * correction of one that was already there.
 */
export interface SubmitSetContext {
  /** true when a set with this index was already persisted before this submit. */
  isExistingSet: boolean;
}

interface Props {
  exercise: Exercise;
  onSubmit: () => void;
  suggest?: boolean;
  trainingsId?: number;
  workout?: Workout;
  onSubmitSet?: (workoutSet: WorkoutSet, context: SubmitSetContext) => void;
  date: Date;
  info?: React.ReactNode;
  linkVideoMode?: boolean;
  onDisableLinkVideoMode?: () => void;
  onLiveInputChange?: (input: {reps: number; rir: number; weight: number}) => void;
  oneRepMaxRef?: (oneRm: number) => void;
  allowRefinalizeWhenDone?: boolean;
  /**
   * GH-63: the number of the set that is about to be logged, when the caller
   * knows it better than this component can. During a planned training that is
   * the next OPEN planned set — the fallback below would instead count the
   * planned-but-unlogged sets that are merged in as pending rows and show a
   * number the user has not reached yet. Left `undefined` (every other caller)
   * the original counter is used unchanged.
   */
  nextSetIndex?: number;
}

const AddWorkout = ({exercise, onSubmit, suggest, trainingsId, workout, onSubmitSet, date, info, linkVideoMode, onDisableLinkVideoMode, onLiveInputChange, oneRepMaxRef, allowRefinalizeWhenDone, nextSetIndex}: Props) => {
  let unfinishedWorkout = useUnfinishedWorkout(exercise.id!!);
  // GH-443: the merged workout above also carries the planned-but-unlogged sets
  // (START_TRAINING copies the plan into `suggestedWorkouts`). Logging one of
  // those rows for the first time IS a new set, so "already logged" has to be
  // decided against the persisted workout only — same source the target banner
  // uses (GH-63).
  const persistedWorkout = usePersistedUnfinishedWorkout(exercise.id!!);
  const loggedWorkout = workout ?? persistedWorkout;
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
  const loggedSetIndicesRef = React.useRef<number[]>([]);
  const nextSetIndexRef = React.useRef(nextSetIndex);
  const addWorkoutRef = React.useRef(addWorkout);
  const addOrUpdateSetInWorkoutRef = React.useRef(addOrUpdateSetInWorkout);
  const deleteSetFromWorkoutRef = React.useRef(deleteSetFromWorkout);

  unfinishedWorkoutRef.current = unfinishedWorkout;
  dateRef.current = date;
  exerciseIdRef.current = exercise.id;
  trainingsIdRef.current = trainingsId;
  onSubmitSetRef.current = onSubmitSet;
  loggedSetIndicesRef.current = (loggedWorkout?.sets ?? []).map((it) => it.index).filter((index): index is number => index !== undefined);
  nextSetIndexRef.current = nextSetIndex;
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

  const submitWorkoutSet = React.useCallback((incomingSet: WorkoutSet) => {
    // The new-set input submits without an index and lets the reducer pick the
    // next one. During a planned training that guess is wrong: the reducer would
    // continue after the planned rows instead of filling the planned set the
    // header just announced. Stamp the announced number so the set that is
    // created is the set the user was told they were logging (GH-63).
    const workoutSet = incomingSet.index === undefined && nextSetIndexRef.current !== undefined ? {...incomingSet, index: nextSetIndexRef.current} : incomingSet;
    // Read BEFORE the dispatch below writes the set — afterwards every set looks logged.
    const isExistingSet = workoutSet.index !== undefined && loggedSetIndicesRef.current.includes(workoutSet.index);
    onSubmitSetRef.current?.(workoutSet, {isExistingSet});
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
        {/* GH-428: the counter is also the readable proof of how many sets are logged —
            an e2e flow asserts it is unchanged after an "Add" that must write nothing. */}
        <Text testID="add-workout-set-number" style={styles.setText}>{` Set ${nextSetIndex ?? (unfinishedWorkout?.sets ? unfinishedWorkout.sets.length + 1 : 1)}`}</Text>
        {info && info}
      </View>
      <View style={styles.contentContainer}>
        {/*
          GH-428 (H4): the input row keeps reps/rir/weight in local state. Switching
          the exercise inside a running training re-renders this component with a new
          `exercise` but reconciles onto the same element, so the previous exercise's
          numbers stayed in the fields — and the one-tap "Add" the user is trained to
          press logged them against the new exercise. Keying by exercise remounts the
          row, which is what clears the draft.
        */}
        <AddWorkoutSet key={`add-workout-set-${exercise.id}`} onSubmit={submitWorkoutSet} oneRepMax={oneRepMax} date={date} onLiveInputChange={onLiveInputChange} />
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
            // Already-finalized workouts (edit mode, allowRefinalizeWhenDone) must not be
            // re-finalized: re-dispatching FINALIZE_WORKOUT would overwrite the existing
            // `end` with the current date/picker value, corrupting history/ordering (GH-323 P2-b).
            if (workout?.end === undefined) {
              finalizeWorkout(sameDate(date, new Date(Date.now())) ? new Date(Date.now()) : date, unfinishedWorkout?.id!!);
            }
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
