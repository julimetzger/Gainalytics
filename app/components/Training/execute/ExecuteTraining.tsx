import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import AddWorkout, {SubmitSetContext} from '../../Workout/add/AddWorkout';
import {useWorkoutById} from '../../../redux/Workout/use/useWorkoutById';
import {useNextTrainingsId} from '../../../redux/Training/use/useNextTrainingsId';
import {usePersistedUnfinishedWorkout, useUnfinishedWorkout} from '../../../redux/Workout/use/useUnfinishedWorkout';
import {Training} from '../../../models/entities/Training';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {IconButton, Text, Tooltip} from 'react-native-paper';
import EditDialogScaffold from '../../common/EditDialogScaffold';
import WorkoutSetView from '../../Workout/show/WorkoutSetView';
import ExerciseHistory from '../../exercise/show/ExerciseHistory';

import DatePicker from '../../picker/date/DatePicker';
import Estimated1RmCard from './Estimated1RmCard';
import PlannedSetTarget, {resolveNextSetNumber} from './PlannedSetTarget';
import ExerciseRecordsModal from './ExerciseRecordsModal';
import {TrainingsState} from '../../../models/TrainingsState';
import RestTimerCard from './RestTimerCard';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {useAllTimeOneRepMax} from '../../../redux/Workout/use/useAllTimeOneRepMax';
import {useLastFinishedWorkoutsByExerciseIds} from '../../../redux/Workout/use/useLastFinishedWorkoutsByExerciseIds';
import {
  dispatchDismissRestTimer,
  dispatchResetRestTimer,
  dispatchSetRestTimerExerciseDefault,
  dispatchStartRestTimer,
  dispatchUpdateRestTimerTarget,
} from '../../../redux/settings/dispatch/dispatchRestTimer';

const DEFAULT_REST_SECONDS = 90;

const ExecuteTraining = ({training, chosenExercise, onSubmit, onSubmitSet, onScheduleNotification, onCancelNotification, editMode}: Props) => {
  let doneWorkoutId = training.doneWorkoutIds[chosenExercise.id!!];
  let doneWorkout = useWorkoutById(doneWorkoutId);
  let nextTrainingsId = useNextTrainingsId();
  const unfinishedWorkout = useUnfinishedWorkout(chosenExercise.id!);
  const persistedWorkout = usePersistedUnfinishedWorkout(chosenExercise.id!);
  let plannedWorkout = useWorkoutById(training.plannedWorkouts[chosenExercise.id!!]);
  let [openPlanned, setOpenPlanned] = useState(false);
  let [openHistory, setOpenHistory] = useState(false);
  let [openRecords, setOpenRecords] = useState(false);
  let [linkVideoMode, setLinkVideoMode] = useState(false);

  const [date, setDate] = useState(new Date(Date.now()));
  const [liveInput, setLiveInput] = useState({reps: 0, rir: 0, weight: 0});
  const [lastTrainingOneRm, setLastTrainingOneRm] = useState<number | undefined>(undefined);
  const allTimePr = useAllTimeOneRepMax(chosenExercise.id);

  // Fallback: if the slot-specific callback doesn't fire (no suggest for this slot),
  // derive the last-exercise 1RM directly from Redux so "vs last training" is never
  // silently blank when the exercise has been done before in any slot.
  const exerciseFallbackWorkouts = useLastFinishedWorkoutsByExerciseIds(
    chosenExercise.id !== undefined ? [chosenExercise.id] : [],
    doneWorkoutId !== undefined ? [doneWorkoutId] : undefined,
  );
  const exerciseFallbackOneRm = useMemo(() => {
    if (exerciseFallbackWorkouts.length === 0) return undefined;
    const rm = oneRepMaxForWorkouts(exerciseFallbackWorkouts[0]);
    return rm > 0 ? rm : undefined;
  }, [exerciseFallbackWorkouts]);

  const settings = useSettings();
  const startRestTimer = dispatchStartRestTimer();
  const resetRestTimer = dispatchResetRestTimer();
  const updateRestTarget = dispatchUpdateRestTimerTarget();
  const dismissRestTimer = dispatchDismissRestTimer();
  const setExerciseDefault = dispatchSetRestTimerExerciseDefault();

  const restPerExercise = settings.restTimer?.defaultPerExercise ?? {};
  const userDefaultRest = settings.restTimer?.userDefaultSeconds;
  const exerciseDefaultRest = chosenExercise.id !== undefined ? restPerExercise[chosenExercise.id] : undefined;
  const resolvedRestDefault = exerciseDefaultRest ?? userDefaultRest ?? DEFAULT_REST_SECONDS;

  const activeRest = settings.restTimer?.active ?? null;

  const sessionOneRm = useMemo(
    () => {
      // doneWorkout is the training session's workout (what AddWorkout is actually using).
      // Fall back to the notFinished hook result if doneWorkout isn't created yet.
      const src = doneWorkout ?? unfinishedWorkout;
      return src ? oneRepMaxForWorkouts(src) : 0;
    },
    [doneWorkout, unfinishedWorkout],
  );

  useEffect(() => {
    if (doneWorkout?.start) {
      setDate(new Date(doneWorkout.start));
    }
  }, [doneWorkout?.id, chosenExercise]);

  useEffect(() => {
    setLastTrainingOneRm(undefined);
  }, [chosenExercise.id]);

  const onLiveInputChange = useCallback((input: {reps: number; rir: number; weight: number}) => {
    setLiveInput((prev) => (prev.reps === input.reps && prev.rir === input.rir && prev.weight === input.weight ? prev : input));
  }, []);

  const onPreviousOneRmKnown = useCallback((value: number) => {
    setLastTrainingOneRm(value > 0 ? value : undefined);
  }, []);

  const handleSubmitSet = (workoutSet: WorkoutSet, context?: SubmitSetContext) => {
    onSubmitSet?.(workoutSet);
    // GH-323: adding/editing a set in edit mode must not start a rest timer
    // or schedule a rest notification - the Rest Timer card is hidden here,
    // so there is no UI to reset/skip a timer that starts in the background.
    if (editMode) {
      return;
    }
    // GH-443: the rest starts when a set is LOGGED. Correcting a set that was
    // already logged re-submits it through this same handler (an edited row
    // even auto-submits on blur), which used to restart the running rest and
    // throw away the time the user had already rested. Only a genuinely new
    // set restarts the clock — and its notification.
    if (context?.isExistingSet) {
      return;
    }
    startRestTimer({
      targetSeconds: resolvedRestDefault,
      exerciseId: chosenExercise.id,
      setIndex: workoutSet.index,
      startedAt: Date.now(),
    });
    onScheduleNotification?.(resolvedRestDefault);
  };

  const onResetRest = () => {
    resetRestTimer(Date.now());
    onCancelNotification?.();
  };
  const onSkipRest = () => {
    dismissRestTimer();
    onCancelNotification?.();
  };
  const onEditTarget = (seconds: number, saveAsDefault: boolean) => {
    updateRestTarget(seconds);
    if (saveAsDefault && chosenExercise.id !== undefined) {
      setExerciseDefault(chosenExercise.id, seconds);
    }
  };

  const handleAdjustExerciseDefault = useMemo(
    () =>
      chosenExercise.id === undefined
        ? undefined
        : (seconds: number) => {
            setExerciseDefault(chosenExercise.id!, seconds);
            // If the running rest timer is for this exercise, reflect the new
            // default in the active timer's target line immediately.
            if (activeRest?.exerciseId === chosenExercise.id) {
              updateRestTarget(seconds);
            }
          },
    [chosenExercise.id, setExerciseDefault, activeRest?.exerciseId, updateRestTarget],
  );

  // GH-195 r6: hide redundant date pill while training is STARTED — the app
  // header already shows today's date during an active session. The pill stays
  // for FINISHED-and-editing flows (EditTraining) where doneWorkout.start can
  // be historical and the user may still need to change it.
  const showDatePicker = training.state !== TrainingsState.STARTED;

  // GH-63: what the user has ACTUALLY logged. Deliberately NOT
  // `useUnfinishedWorkout` — that one merges in the suggested workout, i.e. the
  // planned-but-unlogged sets START_TRAINING copies over. Counting those as done
  // is what made the target banner jump straight to the last planned set.
  const loggedSetIndices = useMemo(() => {
    const loggedWorkout = (doneWorkout?.end ? doneWorkout : undefined) ?? persistedWorkout;
    return (loggedWorkout?.sets ?? []).map((workoutSet) => workoutSet.index).filter((index): index is number => index !== undefined);
  }, [doneWorkout, persistedWorkout]);

  // The number of the set about to be logged: the next open planned set while
  // the plan is not worked off yet. `undefined` for an exercise without a plan,
  // so an unplanned training keeps AddWorkout's original counter untouched.
  const plannedSets = plannedWorkout?.sets ?? [];
  const nextSetIndex = plannedSets.length > 0 ? resolveNextSetNumber(plannedSets, loggedSetIndices) : undefined;

  return (
    <View>
      {showDatePicker && (
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
          <DatePicker date={date} setDate={setDate} />
        </View>
      )}
      {/* GH-63: the planned set as a readable target, ranges included. Display
          only — the actual set input below stays untouched. Banner and the
          "Set N" label below it are fed from the same resolver, so they always
          name the same, next open planned set. */}
      <PlannedSetTarget plannedWorkout={plannedWorkout} loggedSetIndices={loggedSetIndices} />
      <AddWorkout
        nextSetIndex={nextSetIndex}
        workout={doneWorkout?.end ? doneWorkout : undefined}
        allowRefinalizeWhenDone={editMode}
        exercise={chosenExercise}
        onSubmit={onSubmit}
        suggest={false}
        trainingsId={training.id ?? nextTrainingsId}
        onSubmitSet={handleSubmitSet}
        date={date}
        linkVideoMode={linkVideoMode}
        onDisableLinkVideoMode={() => setLinkVideoMode(false)}
        onLiveInputChange={onLiveInputChange}
        oneRepMaxRef={onPreviousOneRmKnown}
        info={
          <View style={{display: 'flex', flexDirection: 'row'}}>
            <Tooltip enterTouchDelay={300} title="Shows Exercise History">
              <IconButton
                icon="history"
                onPress={() => {
                  setOpenHistory(true);
                }}
              ></IconButton>
            </Tooltip>
            <Tooltip enterTouchDelay={300} title="Shows Planned Training">
              <IconButton
                icon="book-open-variant"
                onPress={() => {
                  setOpenPlanned(true);
                }}
              ></IconButton>
            </Tooltip>
            <Tooltip enterTouchDelay={300} title={linkVideoMode ? 'Cancel Link Video' : 'Link Video'}>
              <IconButton
                icon={linkVideoMode ? 'close' : 'video-plus'}
                onPress={() => setLinkVideoMode(prev => !prev)}
              ></IconButton>
            </Tooltip>
          </View>
        }
      />
      <Estimated1RmCard
        sessionOneRm={sessionOneRm}
        lastTrainingOneRm={lastTrainingOneRm ?? exerciseFallbackOneRm}
        allTimePr={allTimePr}
        onPressTrophy={() => setOpenRecords(true)}
      />
      {!editMode && (
        <RestTimerCard
          startedAt={activeRest?.startedAt}
          targetSeconds={activeRest?.targetSeconds}
          exerciseId={activeRest?.exerciseId}
          onReset={onResetRest}
          onSkip={onSkipRest}
          onEditTarget={onEditTarget}
          onAdjustExerciseDefault={handleAdjustExerciseDefault}
          exerciseDefaultSeconds={resolvedRestDefault}
        />
      )}
      <ExerciseRecordsModal
        visible={openRecords}
        onDismiss={() => setOpenRecords(false)}
        exercise={chosenExercise}
      />
      <EditDialogScaffold
        visible={openPlanned}
        onDismiss={() => setOpenPlanned(false)}
        title={`Planned Workout for ${chosenExercise.name}`}
        testID="planned-workout-dialog"
        dismissTestID="planned-workout-close"
        scrollable
      >
        {(plannedWorkout?.sets ?? []).length > 0 ? (
          <WorkoutSetView sets={plannedWorkout?.sets ?? []} editable={false} />
        ) : (
          <Text style={{textAlign: 'center', padding: 20}}>No workout planned for {chosenExercise.name}</Text>
        )}
      </EditDialogScaffold>
      <EditDialogScaffold
        visible={openHistory}
        onDismiss={() => setOpenHistory(false)}
        title={`History for ${chosenExercise.name}`}
        testID="exercise-history-dialog"
        dismissTestID="exercise-history-close"
        scrollable
        maxHeightRatio={0.95}
      >
        <ExerciseHistory exercise={chosenExercise} editable={false} />
      </EditDialogScaffold>
    </View>
  );
};

interface Props {
  training: Training;
  chosenExercise: Exercise;
  onSubmit: () => void;
  onSubmitSet?: (workoutSet: WorkoutSet) => void;
  onScheduleNotification?: (seconds: number) => void;
  onCancelNotification?: () => void;
  editMode?: boolean;
}

export default ExecuteTraining;
