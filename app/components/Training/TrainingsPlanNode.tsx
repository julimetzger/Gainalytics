import {Exercise} from '../../models/entities/Exercise';
import {LayoutRectangle, View} from 'react-native';
import {NestableScrollContainer} from 'react-native-draggable-flatlist';
import MicroOverviewTraining from '../../tabs/trainings/MicroOverviewTraining';
import TrainingElementPicker from '../picker/elements/TrainingElementPicker';
import {TrainingsState} from '../../models/TrainingsState';
import {Button, Dialog, Portal, Text} from 'react-native-paper';
import DraggableExercise from './DraggableExercise';
import TrainingsBase from './TrainingsBase';
import PlanTab, {PlanChromeState, PlanMode} from './plan/PlanTab';
import PlanningOverview from './plan/PlanningOverview';
import ExecuteWorkoutInTraining from './execute/ExecuteTraining';
import EditTraining from './execute/EditTraining';
import TrainingsOverview from './analyse/TrainingsOverview';
import TrainingHistory from './analyse/TrainingHistory';
import TrainingModeTabs, {SubTab} from './TrainingModeTabs';
import TrainingOverflowMenu from './TrainingOverflowMenu';
import React, {useEffect, useState} from 'react';
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
import {getPreviousMicroInMeso} from '../../redux/Training/trainingsPlanReducer';
import {useLastTrainingOfPreviousMeso} from '../../redux/Training/use/useLastTrainingOfPreviousMeso';
import {useWorkoutById} from '../../redux/Workout/use/useWorkoutById';
import {dispatchReplaceExerciseInTraining} from '../../redux/Training/dispatch/general/dispatchReplaceExerciseInTraining';
import ExerciseAlternativesDialog from './ExerciseAlternativesDialog';

interface TrainingsPlanNodeProps {
  trainingsPlan: TrainingsPlan;
  trainingInMicro: number;
  micro: number;
  showDone: boolean;
  showPlanned: boolean;
  setIgnoreSwipe: (ignoreSwipe: LayoutRectangle[]) => void;
  /** Pass false when this node is an off-screen swiper pane to suppress AI API calls. */
  isActive?: boolean;
  microViewMode?: ViewMode;
  onMicroViewModeChange?: (mode: ViewMode) => void;
  microSortMode?: ExerciseSortMode;
  onMicroSortModeChange?: (mode: ExerciseSortMode) => void;
  overflowVisible: boolean;
  onCloseOverflow: () => void;
  onPlanChromeChange?: (state: PlanChromeState) => void;
}

export const defaultSubTab = (state?: string): SubTab => {
  if (state === TrainingsState.PLANNED) return 'plan';
  if (state === TrainingsState.STARTED) return 'train';
  if (state === TrainingsState.FINISHED) return 'analysis';
  return 'plan'; // no training → Plan tab shows TrainingsBase (add/suggest)
};

const TrainingsPlanNode = ({trainingsPlan, micro, trainingInMicro, showPlanned, showDone, setIgnoreSwipe, isActive = true, microViewMode, onMicroViewModeChange, microSortMode, onMicroSortModeChange, overflowVisible, onCloseOverflow, onPlanChromeChange}: TrainingsPlanNodeProps) => {
  const [localViewMode, setLocalViewMode] = useState<ViewMode>('gesamt');
  const effectiveViewMode = microViewMode ?? localViewMode;
  const effectiveSetViewMode = onMicroViewModeChange ?? setLocalViewMode;
  const [localSortMode, setLocalSortMode] = useState<ExerciseSortMode>('plan');
  const effectiveSortMode = microSortMode ?? localSortMode;
  const effectiveSetSortMode = onMicroSortModeChange ?? setLocalSortMode;
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

  const [activeSubTab, setActiveSubTab] = useState<SubTab>(defaultSubTab(training?.state));
  const [isEditing, setIsEditing] = useState(false);
  const [planEditRequestId, setPlanEditRequestId] = useState(0);

  // Reset sub-tab when micro/trainingInMicro changes OR when training state changes (e.g. async load → PLANNED)
  useEffect(() => {
    setActiveSubTab(defaultSubTab(training?.state));
    setIsEditing(false);
    setShowPicker(false);
    setPlanEntryRequested(false);
    setNextPlanMode('read');
  }, [micro, trainingInMicro, training?.state]);

  // GH-263 Item 1: once the user has picked at least one exercise after tapping
  // "Plan new Training", clear the entry-requested flag and the picker so PlanTab
  // takes over the normal rendering path.
  useEffect(() => {
    if (planEntryRequested && exercises.length > 0) {
      setPlanEntryRequested(false);
      setShowPicker(false);
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

  function handleStart() {
    startTraining();
    if (!appSettings.toggles?.disableToasts) {
      Toast.show({
        type: 'info',
        text1: 'Training started!',
        text2: `You started ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
    setActiveSubTab('train');
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
        text2: `Congratulations, you finished ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
    setActiveSubTab('analysis');
    setTimeInWorkout(new Date(Date.now()));
  }

  function handleEditTraining() {
    if (chosenExercise === undefined && exercises?.length > 0) setchosenExercise(exercises[0].id);
    setIsEditing(true);
    setActiveSubTab('train');
  }

  function handleDeleteTraining() {
    setShowDeleteDialog(true);
  }

  function handleEditPlan() {
    setActiveSubTab('plan');
    setPlanEditRequestId((currentRequestId) => currentRequestId + 1);
  }

  function goToNextExercise() {
    const number = exercises.indexOf(chosenExercise!!) + 1;
    if (number >= exercises.length) {
      if (isEditing) {
        setIsEditing(false);
        setActiveSubTab('analysis');
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
        hasExercises={(training?.exercises?.length ?? 0) > 0}
        onStart={handleStart}
        onFinish={handleFinish}
        onEditPlan={handleEditPlan}
        onEditTraining={handleEditTraining}
        onDeleteTraining={handleDeleteTraining}
      />
      {/* flex:1 bounds the container to the swiper pane (which RangeSwiper
          pins to the viewport via fillViewport) so it scrolls internally;
          unbounded it grows to its content and nothing scrolls (GH-382). */}
      <NestableScrollContainer style={{flex: 1}} keyboardShouldPersistTaps={'handled'}>
        <View>
          {showDone ? (
            <MicroOverviewTraining trainingsPlan={trainingsPlan} micro={micro} isActive={isActive} viewMode={effectiveViewMode} onViewModeChange={effectiveSetViewMode} sortMode={effectiveSortMode} onSortModeChange={effectiveSetSortMode} />
          ) : (
            <View>
              <TrainingModeTabs activeTab={activeSubTab} onTabChange={setActiveSubTab} />

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
                  {showPlanned && <PlanningOverview trainingsPlan={trainingsPlan} micro={micro} />}
                </View>
              )}

              {/* Train Tab */}
              {activeSubTab === 'train' && (
                <View>
                  {training?.state === TrainingsState.PLANNED && (
                    <View style={{padding: 24, alignItems: 'center'}}>
                      <Button testID="train-tab-start-button" mode="contained" onPress={handleStart}>
                        Start Training
                      </Button>
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
                          />
                        </View>
                      )}
                      {chosenExercise && (
                        <ExecuteWorkoutInTraining training={training} key={refresHeky} chosenExercise={chosenExercise} onSubmit={() => goToNextExercise()} onSubmitSet={() => onSubmitSet()} onScheduleNotification={(secs) => schedulePauseDoneNotification(secs)} onCancelNotification={resetPauseNotification} editMode={isEditing} />
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
                          />
                        </View>
                      )}
                      {isEditing && chosenExercise && (
                        <EditTraining training={training} key={refresHeky} chosenExercise={chosenExercise} onSubmit={() => goToNextExercise()} onSubmitSet={() => onSubmitSet()} />
                      )}
                      {!isEditing && <TrainingHistory training={training} />}
                    </View>
                  )}
                  {training === undefined && (
                    <View style={{padding: 24, alignItems: 'center'}}>
                      <Text>Start training to begin</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Analysis Tab */}
              {activeSubTab === 'analysis' && (
                <View>
                  {training?.state === TrainingsState.FINISHED || training?.state === TrainingsState.STARTED ? (
                    <TrainingsOverview training={training} previousTraining={lastTraining} trainingsPlan={trainingsPlan} currentMicro={micro} trainingInMicro={trainingInMicro} />
                  ) : (
                    <View style={{padding: 24, alignItems: 'center'}}>
                      <Text>Analysis available after the training is finished</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </NestableScrollContainer>
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Training</Dialog.Title>
          <Dialog.Content>
            <Text>This will delete this training and all connected planned and done workouts. This action cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onPress={onDeleteTraining}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default TrainingsPlanNode;
