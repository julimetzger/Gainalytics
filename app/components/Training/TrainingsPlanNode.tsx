import {Exercise} from '../../models/entities/Exercise';
import {LayoutRectangle, View} from 'react-native';
import KeyboardAwareScrollView from '../common/KeyboardAwareScrollView';
import {NestableScrollContainerProvider, useNestableScrollContainerContext} from 'react-native-draggable-flatlist';
import MicroOverviewTraining from '../../tabs/trainings/MicroOverviewTraining';
import TrainingElementPicker from '../picker/elements/TrainingElementPicker';
import {TrainingsState} from '../../models/TrainingsState';
import {Button, Text, useTheme} from 'react-native-paper';
import {ConfirmDialog} from '../common/EditDialogScaffold';
import DraggableExercise from './DraggableExercise';
import TrainingsBase from './TrainingsBase';
import PlanTab, {PlanChromeState, PlanMode} from './plan/PlanTab';
import ExecuteWorkoutInTraining from './execute/ExecuteTraining';
import EditTraining from './execute/EditTraining';
import TrainingsOverview from './analyse/TrainingsOverview';
import TrainingHistory from './analyse/TrainingHistory';
import AnalysisDataToggle, {AnalysisDataMode} from './analyse/AnalysisDataToggle';
import AnalysisTotalSets from './analyse/AnalysisTotalSets';
import TrainingPlanOverview from './analyse/TrainingPlanOverview';
import TrainingModeTabs, {SubTab} from './TrainingModeTabs';
import TrainingOverflowMenu from './TrainingOverflowMenu';
import React, {memo, useEffect, useRef, useState} from 'react';
import {ViewMode} from '../../tabs/trainings/MicroOverviewTraining';
import {ExerciseSortMode} from './analyse/MicroExerciseOverview';
import {dispatchStartTraining} from '../../redux/Training/dispatch/plan/dispatchStartTraining';
import {useExerciseByIds} from '../../redux/Exercises/use/useExerciseByIds';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {dispatchModifyExercisesInTraining} from '../../redux/Training/dispatch/general/dispatchModifyExercisesInTraining';
import {dispatchFinishTraining} from '../../redux/Training/dispatch/execute/dispatchFinishTraining';
import Toast from 'react-native-toast-message';
import {useTrainingInTrainingsPlan} from '../../redux/Training/use/useTrainingInTrainingsPlan';
import {PauseDoneNotification} from './execute/PauseDoneNotification';
import {FinishTrainingNotification} from './execute/FinishTrainingNotification';
import {useSettings} from '../../redux/settings/use/useSettings';
import {dispatchDeleteTraining} from '../../redux/Training/dispatch/general/dispatchDeleteTraining';
import {getLocalMicro, getMesoForMicro, getPreviousMicroInMeso} from '../../redux/Training/trainingsPlanReducer';
import {useLastTrainingOfPreviousMeso} from '../../redux/Training/use/useLastTrainingOfPreviousMeso';
import {useWorkoutById} from '../../redux/Workout/use/useWorkoutById';
import {dispatchReplaceExerciseInTraining} from '../../redux/Training/dispatch/general/dispatchReplaceExerciseInTraining';
import ExerciseAlternativesDialog from './ExerciseAlternativesDialog';
import {trainingsPlanDisplayName} from '../../utils/trainings-plan-name';
import MicroPanePlaceholder from './MicroPanePlaceholder';
import {ProgressiveMount} from '../common/ProgressiveMount';

interface TrainingsPlanNodeProps {
  trainingsPlan: TrainingsPlan;
  trainingInMicro: number;
  micro: number;
  showDone: boolean;
  setIgnoreSwipe: (ignoreSwipe: LayoutRectangle[]) => void;
  /** Pass false when this node is an off-screen swiper pane to suppress AI API calls. */
  isActive?: boolean;
  /**
   * PERF-003: false renders a light placeholder (title + sub-tab bar) instead of the
   * micro's content. The node itself stays mounted, so its state (sub-tab, chosen
   * exercise, ...) is kept; only the heavy view tree is not built.
   */
  renderContent?: boolean;
  microViewMode?: ViewMode;
  onMicroViewModeChange?: (mode: ViewMode) => void;
  microSortMode?: ExerciseSortMode;
  onMicroSortModeChange?: (mode: ExerciseSortMode) => void;
  /** GH-417: planned vs. actual data in the Analysis tab. Owned by the screen so
   *  the choice survives micro swipes and sub-tab changes. */
  analysisDataMode?: AnalysisDataMode;
  onAnalysisDataModeChange?: (mode: AnalysisDataMode) => void;
  overflowVisible: boolean;
  onCloseOverflow: () => void;
  onPlanChromeChange?: (state: PlanChromeState) => void;
  /** Sub-tab explicitly requested by the caller (navigation param), overrides the state default. */
  requestedSubTab?: SubTab;
  /** GH-467: the tab the user is on, owned by the screen. A pane that moves to another micro opens on it. */
  stickySubTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  /** GH-467: this pane is the micro the user is on (not a neighbour). */
  isCurrent?: boolean;
}

const SUB_TABS: SubTab[] = ['train', 'plan', 'analysis'];

/** GH-467: the carried-over tab if this training can show it, else the state default. Every tab renders in every state. */
export const resolveSubTab = (sticky: SubTab | undefined, state?: string): SubTab =>
  sticky !== undefined && SUB_TABS.includes(sticky) ? sticky : defaultSubTab(state);

export const defaultSubTab = (state?: string, requestedSubTab?: SubTab): SubTab => {
  if (requestedSubTab !== undefined) return requestedSubTab;
  if (state === TrainingsState.PLANNED) return 'plan';
  if (state === TrainingsState.STARTED) return 'train';
  if (state === TrainingsState.FINISHED) return 'analysis';
  return 'plan'; // no training → Plan tab shows TrainingsBase (add/suggest)
};

// GH-324: plain react-native ScrollView instead of the library's
// NestableScrollContainer (a reanimated AnimatedScrollView). On Fabric the
// animated scroll view clipped its content at a stale height — everything in
// plan full-edit below ~490dp was laid out but never drawn. The provider stays
// so PlanEditList's pan-drags can freeze this scroll while a drag is in
// flight (scrollEnabled comes from the same context the library used).
//
// GH-382: flex:1 bounds the scroller to the swiper pane (RangeSwiper pins it to
// the viewport via fillViewport) so it scrolls internally; unbounded it grows to
// its content and nothing scrolls.
//
// GH-428 (H2): KeyboardAwareScrollView is a plain ScrollView that additionally
// scrolls the focused input clear of the keyboard. Everything below the keyboard
// was reachable before, but only by scrolling by hand — so planning a set in the
// lower half meant typing into a field hidden behind the keyboard.
const PlanNodeScrollContainer = ({children}: {children: React.ReactNode}) => {
  const nestableScrollContext = useNestableScrollContainerContext();
  return (
    <KeyboardAwareScrollView style={{flex: 1}} keyboardShouldPersistTaps={'handled'} scrollEnabled={nestableScrollContext?.outerScrollEnabled ?? true}>
      {children}
    </KeyboardAwareScrollView>
  );
};

const TrainingsPlanNode = ({trainingsPlan, micro, trainingInMicro, showDone, setIgnoreSwipe, isActive = true, renderContent = true, microViewMode, onMicroViewModeChange, microSortMode, onMicroSortModeChange, analysisDataMode, onAnalysisDataModeChange, overflowVisible, onCloseOverflow, onPlanChromeChange, requestedSubTab, stickySubTab, onSubTabChange, isCurrent = true}: TrainingsPlanNodeProps) => {
  const [localViewMode, setLocalViewMode] = useState<ViewMode>('gesamt');
  const effectiveViewMode = microViewMode ?? localViewMode;
  const effectiveSetViewMode = onMicroViewModeChange ?? setLocalViewMode;
  const [localSortMode, setLocalSortMode] = useState<ExerciseSortMode>('plan');
  const effectiveSortMode = microSortMode ?? localSortMode;
  const effectiveSetSortMode = onMicroSortModeChange ?? setLocalSortMode;
  // AC1: start position is Train, i.e. exactly what the analysis view showed before.
  const [localAnalysisDataMode, setLocalAnalysisDataMode] = useState<AnalysisDataMode>('train');
  const effectiveAnalysisDataMode = analysisDataMode ?? localAnalysisDataMode;
  const effectiveSetAnalysisDataMode = onAnalysisDataModeChange ?? setLocalAnalysisDataMode;
  const training = useTrainingInTrainingsPlan(trainingsPlan.id!!, micro, trainingInMicro);
  const previousMicro = getPreviousMicroInMeso(trainingsPlan.mesos, micro);
  const lastTrainingInSameMeso = useTrainingInTrainingsPlan(trainingsPlan.id!!, previousMicro ?? -1, trainingInMicro);
  const lastTrainingFromPreviousMeso = useLastTrainingOfPreviousMeso(trainingsPlan.id!!, trainingInMicro, micro);
  const lastTraining = lastTrainingInSameMeso ?? lastTrainingFromPreviousMeso;
  const startTraining = dispatchStartTraining(training?.id);
  const [timeInWorkout, setTimeInWorkout] = useState(new Date(Date.now()));
  const [refresHeky, setRefresHeky] = useState(Math.random());
  let exercises = useExerciseByIds(training?.exercises ?? []);
  const [chosenExercises, setchosenExercise] = useState(exercises[0]?.id);
  let chosenExercise = exercises.find((exercise) => exercise.id === chosenExercises);

  // exercises arrive after Redux REHYDRATE — re-initialize if still unset
  useEffect(() => {
    if (chosenExercises === undefined && exercises?.length > 1) {
      setchosenExercise(exercises[0].id);
    }
  }, [exercises?.length]);
  let doneExerciseIds = training?.doneWorkoutIds ? Object.keys(training.doneWorkoutIds).map((key) => parseInt(key)) : [];
  let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
  let finishTraining = dispatchFinishTraining();
  let [schedulePauseDoneNotification, resetPauseNotification] = PauseDoneNotification();
  let [scheduleFinisTraining, resetFinishTraining] = FinishTrainingNotification();
  let appSettings = useSettings();
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [nextPlanMode, setNextPlanMode] = useState<PlanMode>('read');
  const [planEntryRequested, setPlanEntryRequested] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAlternativesDialog, setShowAlternativesDialog] = useState(false);
  const deleteTraining = dispatchDeleteTraining();
  const replaceExerciseInTraining = dispatchReplaceExerciseInTraining();
  const plannedWorkout = useWorkoutById(chosenExercise?.id !== undefined ? training?.plannedWorkouts?.[chosenExercise.id] : undefined);
  const doneWorkout = useWorkoutById(chosenExercise?.id !== undefined ? training?.doneWorkoutIds?.[chosenExercise.id] : undefined);
  const alternativeExercises = useExerciseByIds(chosenExercise?.alternativeIds ?? [])
    .filter((exercise) => exercise !== undefined)
    .filter((exercise) => exercise.id !== undefined && exercise.id !== chosenExercise?.id && !(training?.exercises ?? []).includes(exercise.id)) as Exercise[];

  const [activeSubTab, setActiveSubTab] = useState<SubTab>(requestedSubTab ?? resolveSubTab(stickySubTab, training?.state));
  const [isEditing, setIsEditing] = useState(false);
  const [planEditRequestId, setPlanEditRequestId] = useState(0);
  // A requested sub-tab must win exactly once per slot — otherwise every later
  // state change (e.g. PLANNED → STARTED) would drag the user back to it.
  // Slot-keyed because RangeSwiper reuses pane instances across micro slots.
  //
  // The consumed keys have to be remembered as a SET, not as a single "last
  // applied" key: RangeSwiper hands the navigation request only to the pane it
  // considers active, so swiping away sets requestedSubTab back to undefined.
  // A single ref would be cleared by that, and swiping back would make the very
  // same request look unconsumed again — re-applying it on top of whatever tab
  // the user (or handleFinish's Analysis pre-selection) had chosen since.
  const consumedSubTabRequestsRef = useRef<Set<string>>(new Set());
  // What the last state-default reset was keyed on. Guards the reset below so a
  // requestedSubTab that merely appears or disappears (pane going in/out of
  // focus) never counts as a reason to reset the tab.
  const subTabResetKeyRef = useRef<string | null>(null);

  // GH-467: set once the user (or a handler) picked a tab on this slot. Until then a state change
  // (async load → PLANNED) keeps the carried-over tab instead of falling back to the state default.
  const subTabTouchedRef = useRef(false);
  const slotKeyRef = useRef(`${micro}:${trainingInMicro}`);
  const changeSubTab = (tab: SubTab) => {
    subTabTouchedRef.current = true;
    setActiveSubTab(tab);
    if (isCurrent) onSubTabChange?.(tab);
  };

  // Reset sub-tab when micro/trainingInMicro changes OR when training state changes (e.g. async load → PLANNED)
  useEffect(() => {
    const slotKey = `${micro}:${trainingInMicro}`;
    if (slotKeyRef.current !== slotKey) {
      slotKeyRef.current = slotKey;
      subTabTouchedRef.current = false;
    }
    const requestKey = requestedSubTab !== undefined ? `${micro}:${trainingInMicro}:${requestedSubTab}` : null;
    if (requestKey !== null && !consumedSubTabRequestsRef.current.has(requestKey)) {
      consumedSubTabRequestsRef.current.add(requestKey);
      subTabResetKeyRef.current = `${micro}:${trainingInMicro}:${training?.state}`;
      setActiveSubTab(requestedSubTab!!);
      if (isCurrent) onSubTabChange?.(requestedSubTab!!);
      return;
    }
    const resetKey = `${micro}:${trainingInMicro}:${training?.state}`;
    if (subTabResetKeyRef.current === resetKey) return;
    subTabResetKeyRef.current = resetKey;
    const next = subTabTouchedRef.current ? defaultSubTab(training?.state) : resolveSubTab(stickySubTab, training?.state);
    setActiveSubTab(next);
    if (isCurrent && stickySubTab === undefined) onSubTabChange?.(next);
  }, [micro, trainingInMicro, training?.state, requestedSubTab]);

  // GH-467: a pane kept in the background (swiping back to it) may hold an older tab than the one the user
  // has picked since; it follows the carried-over tab the moment it becomes the current pane.
  useEffect(() => {
    if (!isCurrent || stickySubTab === undefined || requestedSubTab !== undefined) return;
    if (stickySubTab !== activeSubTab) setActiveSubTab(resolveSubTab(stickySubTab, training?.state));
  }, [isCurrent, stickySubTab]);

  // GH-401 (H3): editing UI state resets only when the user moves to a DIFFERENT
  // slot. It used to reset on `training?.state` as well, which is the root cause of
  // the audit's blank exercise picker: picking the very first exercise creates the
  // training, flipping state undefined → PLANNED, so this effect ran mid-selection
  // and closed the picker. The modal is a separate native window, so what the user
  // saw was its empty shell — a search field over a blank area — and only closing
  // and re-opening the picker brought the list back.
  useEffect(() => {
    setIsEditing(false);
    setShowPicker(false);
    setPlanEntryRequested(false);
    setNextPlanMode('read');
  }, [micro, trainingInMicro]);

  // GH-263 Item 1: once the user has picked at least one exercise after tapping
  // "Plan new Training", clear the entry-requested flag so PlanTab takes over the
  // normal rendering path.
  // GH-401 (H3): the picker deliberately stays open here. Closing it on the first
  // pick made a multi-exercise selection impossible in one pass — the user had to
  // re-open the picker for every additional exercise, and the re-open is exactly
  // the interaction the UX audit found people don't discover.
  useEffect(() => {
    if (planEntryRequested && exercises.length > 0) {
      setPlanEntryRequested(false);
    }
  }, [planEntryRequested, exercises.length]);

  useEffect(() => {
    if (exercises.length === 0) {
      setchosenExercise(undefined);
      return;
    }
    if (chosenExercises === undefined || !exercises.some((exercise) => exercise.id === chosenExercises)) {
      setchosenExercise(exercises[0].id);
    }
  }, [chosenExercises, exercises]);

  useEffect(() => {
    if (!isActive || onPlanChromeChange === undefined) {
      return;
    }
    if (activeSubTab !== 'plan') {
      onPlanChromeChange({
        mode: 'read',
        exitToRead: () => undefined,
        handleBack: () => false,
      });
    }
  }, [activeSubTab, isActive, onPlanChromeChange]);

  useEffect(() => {
    if (training?.state === TrainingsState.STARTED) {
      startTraining();
    }
  }, [micro, trainingInMicro]);

  function setExerciseWithSideEffects(exercises: Exercise[]) {
    modifyExercisesInTraining(exercises, trainingsPlan.id!!, micro, trainingInMicro, training?.id);
  }

  // GH-401 (review 1): an empty training must never reach STARTED. The Train tab
  // already hides the start control in that case; this guard keeps the invariant
  // if any other caller ever wires itself up to handleStart.
  const canStart = (training?.exercises?.length ?? 0) > 0;

  /** Opens the Plan tab in plan mode — the one place where exercises get added. */
  function handleAddExercises() {
    setNextPlanMode('fullEdit');
    setPlanEntryRequested(true);
    changeSubTab('plan');
  }

  function handleStart() {
    if (!canStart) {
      handleAddExercises();
      return;
    }
    startTraining();
    if (!appSettings.toggles?.disableToasts) {
      Toast.show({
        type: 'info',
        text1: 'Training started!',
        text2: `You started ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlanDisplayName(trainingsPlan.name)}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
    changeSubTab('train');
    setTimeInWorkout(new Date(Date.now()));
  }

  function handleFinish() {
    if (!training?.id) return;
    finishTraining(training.id, trainingsPlan.id!!);
    resetPauseNotification();
    resetFinishTraining();
    if (!appSettings.toggles?.disableToasts) {
      Toast.show({
        type: 'info',
        text1: 'Training finished!',
        text2: `Congratulations, you finished ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlanDisplayName(trainingsPlan.name)}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
    changeSubTab('analysis');
    setTimeInWorkout(new Date(Date.now()));
  }

  function handleEditTraining() {
    if (chosenExercise === undefined && exercises?.length > 0) setchosenExercise(exercises[0].id);
    setIsEditing(true);
    changeSubTab('train');
  }

  function handleDeleteTraining() {
    setShowDeleteDialog(true);
  }

  function handleEditPlan() {
    changeSubTab('plan');
    setPlanEditRequestId((currentRequestId) => currentRequestId + 1);
  }

  function goToNextExercise() {
    const number = exercises.indexOf(chosenExercise!!) + 1;
    if (number >= exercises.length) {
      if (isEditing) {
        setIsEditing(false);
        changeSubTab('analysis');
      }
      return;
    }
    setRefresHeky(Math.random());
    setTimeInWorkout(new Date(Date.now()));
    setchosenExercise(exercises[number].id);
    if (training?.state === TrainingsState.STARTED) {
      scheduleFinisTraining();
    }
    resetPauseNotification();
  }

  const onSubmitSet = () => {
    setTimeInWorkout(new Date(Date.now()));
    if (training?.state === TrainingsState.STARTED) {
      scheduleFinisTraining();
    }
  };

  function onDeleteTraining() {
    if (!training?.id || !trainingsPlan.id) return;
    const workoutIds = [
      ...Object.values(training.plannedWorkouts ?? {}),
      ...Object.values(training.doneWorkoutIds ?? {}),
    ].filter((value, index, array) => array.indexOf(value) === index);
    deleteTraining({
      trainingsPlanId: trainingsPlan.id,
      trainingsId: training.id,
      micro,
      trainingInMicro,
      workoutIds,
    });
    setShowDeleteDialog(false);
    setIsEditing(false);
  }

  function onExerciseDoublePress(exercise: Exercise) {
    if (training?.state === TrainingsState.FINISHED) {
      return;
    }
    setchosenExercise(exercise.id);
    setShowAlternativesDialog(true);
  }

  function onReplaceExercise(alternativeExercise: Exercise) {
    if (training?.id === undefined || chosenExercise?.id === undefined || alternativeExercise.id === undefined) {
      return;
    }
    replaceExerciseInTraining(training.id, chosenExercise.id, alternativeExercise.id, plannedWorkout, doneWorkout);
    setchosenExercise(alternativeExercise.id);
    setShowAlternativesDialog(false);
  }

  const showExerciseSelector =
    training?.state === TrainingsState.STARTED ||
    training?.state === TrainingsState.PLANNED ||
    (training?.state === TrainingsState.FINISHED && isEditing) ||
    training === undefined;

  return (
    <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
      <TrainingOverflowMenu
        visible={overflowVisible}
        onDismiss={onCloseOverflow}
        trainingState={training?.state}
        activeSubTab={activeSubTab}
        onFinish={handleFinish}
        onEditPlan={handleEditPlan}
        onEditTraining={handleEditTraining}
        onDeleteTraining={handleDeleteTraining}
      />
      {!renderContent ? (
        <MicroPanePlaceholder
          trainingName={trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
          mesoName={getMesoForMicro(trainingsPlan.mesos, micro)?.name}
          localMicro={getLocalMicro(trainingsPlan.mesos, micro)}
          trainingState={showDone ? undefined : training?.state}
          activeTab={!isCurrent && stickySubTab !== undefined ? stickySubTab : activeSubTab}
          onTabChange={changeSubTab}
          showTabs={!showDone}
        />
      ) : (
      <NestableScrollContainerProvider>
        <PlanNodeScrollContainer>
        <View>
          {showDone ? (
            <MicroOverviewTraining trainingsPlan={trainingsPlan} micro={micro} isActive={isActive} viewMode={effectiveViewMode} onViewModeChange={effectiveSetViewMode} sortMode={effectiveSortMode} onSortModeChange={effectiveSetSortMode} />
          ) : (
            <View>
              <TrainingModeTabs activeTab={activeSubTab} onTabChange={changeSubTab} />

              {/* PERF-003: a sub-tab is built over a few commits (see ProgressiveMount), so mounting it —
                  after a swipe or a tap on the tab bar — never costs one big frame. */}
              <ProgressiveMount key={activeSubTab}>

              {/* Plan Tab — shown in all states */}
              {activeSubTab === 'plan' && (
                <View>
                  {(!training || !training.exercises.length) && !planEntryRequested && (
                    <TrainingsBase
                      trainingsPlan={trainingsPlan}
                      micro={micro}
                      trainingInMicro={trainingInMicro}
                      onEnterPlanMode={() => {
                        setNextPlanMode('fullEdit');
                        setPlanEntryRequested(true);
                      }}
                    />
                  )}
                  {(chosenExercise || planEntryRequested) && (
                    <View pointerEvents={'box-none'}>
                      <PlanTab
                        training={training}
                        trainingsPlanId={trainingsPlan.id!!}
                        trainingInMicro={trainingInMicro}
                        micro={micro}
                        exercises={exercises}
                        chosenExercise={chosenExercise}
                        chooseExercise={(exercise) => {
                          setchosenExercise(exercise.id);
                        }}
                        onExerciseDoublePress={onExerciseDoublePress}
                        setExercises={setExerciseWithSideEffects}
                        doneExerciseIds={doneExerciseIds}
                        setAbsolutePosition={(layout) => setIgnoreSwipe([layout])}
                        pickerVisible={showPicker}
                        onTogglePicker={() => setShowPicker(!showPicker)}
                        editPlanRequestId={planEditRequestId}
                        isActive={isActive}
                        onChromeChange={onPlanChromeChange}
                        initialMode={nextPlanMode}
                      />
                      {chosenExercise && (
                        <ExerciseAlternativesDialog
                          visible={showAlternativesDialog}
                          exercise={chosenExercise}
                          alternatives={alternativeExercises}
                          onDismiss={() => setShowAlternativesDialog(false)}
                          onSelect={onReplaceExercise}
                        />
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Train Tab */}
              {activeSubTab === 'train' && (
                <View>
                  {/* GH-401 (H2): the Train tab of a not-yet-started training carries the
                      one real "Start Training" control. Any non-STARTED/non-FINISHED
                      training qualifies — a training whose state never got persisted must
                      not leave the user on a dead end either. */}
                  {training !== undefined && training.state !== TrainingsState.STARTED && training.state !== TrainingsState.FINISHED && (
                    <View style={{padding: 24, alignItems: 'center', gap: 8}}>
                      {/* GH-401 (review 1): a training with no exercises has nothing to log,
                          so it must not be startable — an empty session could be finished and
                          would then count as the plan's last training, advancing the dashboard
                          progress for a workout that never happened. Instead of a disabled
                          button next to a hint nobody reads, the start control is replaced by
                          the action that unblocks the user: it opens the Plan tab straight in
                          plan mode, where exercises are picked. */}
                      {(training.exercises?.length ?? 0) > 0 ? (
                        <>
                          <Button testID="train-tab-start-button" mode="contained" onPress={handleStart}>
                            Start Training
                          </Button>
                          <Text testID="train-tab-start-hint" variant="bodySmall">
                            Starts the session timer and opens set logging.
                          </Text>
                        </>
                      ) : (
                        <>
                          <Button testID="train-tab-add-exercises-button" mode="contained" onPress={handleAddExercises}>
                            Add Exercises
                          </Button>
                          <Text testID="train-tab-start-hint" variant="bodySmall">
                            This training has no exercises yet — add some before you can start it.
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                  {training?.state === TrainingsState.STARTED && (
                    <View>
                      {showExerciseSelector && (
                        <View pointerEvents={'box-none'}>
                          <DraggableExercise
                            exercises={exercises}
                            setExercises={setExerciseWithSideEffects}
                            chosenExercise={chosenExercise}
                            chooseExercise={(exercise) => {
                              setchosenExercise(exercise.id);
                            }}
                            onExerciseDoublePress={onExerciseDoublePress}
                            doneExerciseIds={doneExerciseIds}
                            setAbsolutePosition={(layout) => setIgnoreSwipe([layout])}
                            onTogglePicker={() => setShowPicker(!showPicker)}
                            pickerVisible={showPicker}
                          />
                          <ExerciseAlternativesDialog
                            visible={showAlternativesDialog}
                            exercise={chosenExercise}
                            alternatives={alternativeExercises}
                            onDismiss={() => setShowAlternativesDialog(false)}
                            onSelect={onReplaceExercise}
                          />
                          <TrainingElementPicker
                            exercise={exercises}
                            setExercise={setExerciseWithSideEffects}
                            dropdownLabel="Select Exercises for your Training"
                            hideChip={true}
                            visible={showPicker}
                            onToggle={() => setShowPicker(!showPicker)}
                            hideIconButton={true}
                            openListOnShow={true}
                          />
                        </View>
                      )}
                      {chosenExercise && (
                        <ExecuteWorkoutInTraining training={training} key={refresHeky} chosenExercise={chosenExercise} onSubmit={() => goToNextExercise()} onSubmitSet={() => onSubmitSet()} onScheduleNotification={(secs) => schedulePauseDoneNotification(secs)} onCancelNotification={resetPauseNotification} editMode={isEditing} />
                      )}
                      {/* GH-401 (AC6): finishing must not require the ⋮ menu — the whole
                          Card → Train → Start → log sets → Finish path stays on this tab. */}
                      {!isEditing && (
                        <View style={{padding: 16, alignItems: 'center'}}>
                          {/* GH-437: the finish button carries the theme's secondary
                              colour, not the primary one. Both the fill and the label
                              come from the active scheme so every palette stays legible
                              in light and dark. */}
                          <Button testID="train-tab-finish-button" mode="contained" buttonColor={theme.colors.secondary} textColor={theme.colors.onSecondary} onPress={handleFinish}>
                            Finish Training
                          </Button>
                        </View>
                      )}
                    </View>
                  )}
                  {training?.state === TrainingsState.FINISHED && (
                    <View>
                      {isEditing && (
                        <View pointerEvents={'box-none'}>
                          <DraggableExercise
                            exercises={exercises}
                            setExercises={setExerciseWithSideEffects}
                            chosenExercise={chosenExercise}
                            chooseExercise={(exercise) => {
                              setchosenExercise(exercise.id);
                            }}
                            onExerciseDoublePress={onExerciseDoublePress}
                            doneExerciseIds={doneExerciseIds}
                            setAbsolutePosition={(layout) => setIgnoreSwipe([layout])}
                            onTogglePicker={() => setShowPicker(!showPicker)}
                            pickerVisible={showPicker}
                          />
                          <TrainingElementPicker
                            exercise={exercises}
                            setExercise={setExerciseWithSideEffects}
                            dropdownLabel="Select Exercises for your Training"
                            hideChip={true}
                            visible={showPicker}
                            onToggle={() => setShowPicker(!showPicker)}
                            hideIconButton={true}
                            openListOnShow={true}
                          />
                        </View>
                      )}
                      {isEditing && chosenExercise && (
                        <EditTraining training={training} key={refresHeky} chosenExercise={chosenExercise} onSubmit={() => goToNextExercise()} onSubmitSet={() => onSubmitSet()} />
                      )}
                      {!isEditing && <TrainingHistory training={training} />}
                    </View>
                  )}
                  {/* GH-401 (H2): there is nothing to start until the session exists, so
                      point at the action that creates it instead of asking for one that
                      has no control on this screen. */}
                  {training === undefined && (
                    <View style={{padding: 24, alignItems: 'center', gap: 8}}>
                      <Text testID="train-tab-no-training-hint">Nothing planned for this day yet.</Text>
                      <Button testID="train-tab-go-to-plan-button" mode="contained" onPress={() => changeSubTab('plan')}>
                        Plan this Training
                      </Button>
                    </View>
                  )}
                </View>
              )}

              {/* Analysis Tab */}
              {activeSubTab === 'analysis' && (
                <View testID="analysis-tab">
                  {/* GH-417: planned vs. actual numbers. Rendered in every training
                      state — the Plan position is what makes the planned metrics and
                      the muscle map reachable while a training is still being planned.
                      GH-436: both positions refer to THIS training only; the
                      micro-wide plan lives in the Overview's Plan position. */}
                  <AnalysisDataToggle value={effectiveAnalysisDataMode} onChange={effectiveSetAnalysisDataMode} />
                  {effectiveAnalysisDataMode === 'plan' ? (
                    <TrainingPlanOverview training={training} trainingsPlan={trainingsPlan} micro={micro} trainingInMicro={trainingInMicro} />
                  ) : training?.state === TrainingsState.FINISHED || training?.state === TrainingsState.STARTED ? (
                    <TrainingsOverview training={training} previousTraining={lastTraining} trainingsPlan={trainingsPlan} currentMicro={micro} trainingInMicro={trainingInMicro} />
                  ) : (
                    <View style={{padding: 24, alignItems: 'center'}}>
                      <AnalysisTotalSets totalSets={0} scope="done" />
                      <Text testID="analysis-train-empty">No sets logged yet — start the training on the Train tab. Switch to Plan to see what is planned.</Text>
                    </View>
                  )}
                </View>
              )}
              </ProgressiveMount>
            </View>
          )}
        </View>
        </PlanNodeScrollContainer>
      </NestableScrollContainerProvider>
      )}
      <ConfirmDialog
        visible={showDeleteDialog}
        title="Delete Training"
        message="This will delete this training and all connected planned and done workouts. This action cannot be undone."
        onConfirm={onDeleteTraining}
        onCancel={() => setShowDeleteDialog(false)}
        testID="training-delete-dialog"
        confirmTestID="training-delete-confirm"
        cancelTestID="training-delete-cancel"
      />
    </View>
  );
};

// PERF-003: a swiper pane whose props did not change must not re-render when its siblings do.
export default memo(TrainingsPlanNode);
