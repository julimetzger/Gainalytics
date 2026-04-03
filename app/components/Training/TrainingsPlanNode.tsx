import {Exercise} from '../../models/entities/Exercise';
import {LayoutRectangle, ScrollView, View} from 'react-native';
import MicroOverview from './analyse/MicroOverview';
import TrainingElementPicker from '../picker/elements/TrainingElementPicker';
import {TrainingsState} from '../../models/TrainingsState';
import Timer from './execute/Timer';
import {Button, Dialog, Portal, Text} from 'react-native-paper';
import DraggableExercise from './DraggableExercise';
import TrainingsBase from './TrainingsBase';
import PlanWorkoutInTraining from './plan/PlanTraining';
import PlanningOverview from './plan/PlanningOverview';
import ExecuteWorkoutInTraining from './execute/ExecuteTraining';
import TrainingsOverview from './analyse/TrainingsOverview';
import TrainingHistory from './analyse/TrainingHistory';
import React, {useEffect, useState} from 'react';
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

interface TrainingsPlanNodeProps {
  trainingsPlan: TrainingsPlan;
  trainingInMicro: number;
  micro: number;
  showDone: boolean;
  showPlanned: boolean;
  overview: boolean;
  setOverview: (overview: boolean) => void;
  setIgnoreSwipe: (ignoreSwipe: LayoutRectangle[]) => void;
}

const TrainingsPlanNode = ({trainingsPlan, micro, trainingInMicro, showPlanned, showDone, overview, setOverview, setIgnoreSwipe}: TrainingsPlanNodeProps) => {
  const training = useTrainingInTrainingsPlan(trainingsPlan.id!!, micro, trainingInMicro);
  const previousMicro = getPreviousMicroInMeso(trainingsPlan.mesos, micro);
  const lastTraining = useTrainingInTrainingsPlan(trainingsPlan.id!!, previousMicro ?? -1, trainingInMicro);
  const startTraining = dispatchStartTraining(training?.id);
  const [timeInWorkout, setTimeInWorkout] = useState(new Date(Date.now()));
  const [refresHeky, setRefresHeky] = useState(Math.random());
  let exercises = useExerciseByIds(training?.exercises ?? []);
  const [chosenExercises, setchosenExercise] = useState(exercises?.length > 1 ? exercises[0].id : undefined);
  let chosenExercise = exercises.find((exercise) => exercise.id === chosenExercises);
  let doneExerciseIds = training?.doneWorkoutIds ? Object.keys(training.doneWorkoutIds).map((key) => parseInt(key)) : [];
  let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
  let finishTraining = dispatchFinishTraining();
  let [schedulePauseDoneNotification, resetPauseNotification] = PauseDoneNotification();
  let [scheduleFinisTraining, resetFinishTraining] = FinishTrainingNotification();
  let appSettings = useSettings();
  const [showPicker, setShowPicker] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteTraining = dispatchDeleteTraining();

  useEffect(() => {
    if (training?.state === TrainingsState.STARTED) {
      startTraining();
    }
  }, [micro, trainingInMicro]);

  function setExerciseWithSideEffects(exercises: Exercise[]) {
    modifyExercisesInTraining(exercises, trainingsPlan.id!!, micro, trainingInMicro, training?.id);
  }

  const [isEditing, setIsEditing] = useState(false);

  function changePlanningmode() {
    if (training?.state === TrainingsState.PLANNED) {
      startTraining();
      Toast.show({
        type: 'info',
        text1: 'Training started!',
        text2: `You started ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
    if (training?.state === TrainingsState.STARTED) {
      finishTraining(training.id!!, trainingsPlan.id!!);
      resetPauseNotification();
      resetFinishTraining();
      Toast.show({
        type: 'info',
        text1: 'Training finished!',
        text2: `Congratulations, you finished ${trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro} in ${trainingsPlan.name}`,
        position: 'top',
        visibilityTime: 5000,
      });
    }
    if (training?.state === TrainingsState.FINISHED) {
      if (chosenExercise === undefined && exercises?.length > 0) setchosenExercise(exercises[0].id);
      if (isEditing) {
        setIsEditing(false);
        setOverview(true);
      } else {
        setOverview(!overview);
      }
    }
    setTimeInWorkout(new Date(Date.now()));
  }

  function goToNextExercise() {
    const number = exercises.indexOf(chosenExercise!!) + 1;
    if (number >= exercises.length) {
      if (isEditing) {
        setIsEditing(false);
        setOverview(true);
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
    schedulePauseDoneNotification();
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
    setOverview(true);
  }

  return (
    <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
      <ScrollView keyboardShouldPersistTaps={'handled'}>
        <View>
          {showDone ? (
            <MicroOverview trainingsPlan={trainingsPlan} micro={micro} />
          ) : (
            <View>
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-evenly',
                  height: 65,
                  margin: 5,
                }}
              >
                {!appSettings.toggles?.disableTimer && training?.state === TrainingsState.STARTED && <Timer start={training.start!!} label={'Start Training'} />}
                {training?.state && (
                  <View style={{flexDirection: 'row', gap: 5}}>
                    <Button mode="outlined" style={{alignSelf: 'center'}} onPress={changePlanningmode}>
                      {training?.state === TrainingsState.PLANNED && 'Start Training'}
                      {training?.state === TrainingsState.STARTED && 'Finish Training'}
                      {training?.state === TrainingsState.FINISHED && (isEditing || !overview) && 'Back to Overview'}
                      {training?.state === TrainingsState.FINISHED && !isEditing && overview && 'Show Sets'}
                    </Button>
                    {training?.state === TrainingsState.FINISHED && (overview || !isEditing) && (
                      <Button
                        mode="contained"
                        style={{alignSelf: 'center'}}
                        onPress={() => {
                          if (chosenExercise === undefined && exercises?.length > 0) setchosenExercise(exercises[0].id);
                          setIsEditing(true);
                          setOverview(false);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {training?.state === TrainingsState.FINISHED && isEditing && (
                      <Button mode="contained" onPress={() => setShowDeleteDialog(true)}>
                        Delete Training
                      </Button>
                    )}
                  </View>
                )}
                {!appSettings.toggles?.disableTimer && training?.state === TrainingsState.STARTED && (
                  <Timer start={timeInWorkout} reset={true} label={'Last Set'} exercise={chosenExercise} onReset={[() => schedulePauseDoneNotification()]} />
                )}
              </View>
              {(training?.state === TrainingsState.STARTED || training?.state === TrainingsState.PLANNED || (training?.state === TrainingsState.FINISHED && isEditing) || training === undefined) && (
                <View pointerEvents={'box-none'}>
                  <DraggableExercise
                    exercises={exercises}
                    setExercises={setExerciseWithSideEffects}
                    chosenExercise={chosenExercise}
                    chooseExercise={(exercise) => {
                      setchosenExercise(exercise.id);
                    }}
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
              {training === undefined && <TrainingsBase trainingsPlan={trainingsPlan} micro={micro} trainingInMicro={trainingInMicro} />}
              {chosenExercise && training?.state === TrainingsState.PLANNED && (
                <PlanWorkoutInTraining training={training} trainingsPlanId={trainingsPlan.id!!} trainingInMicro={trainingInMicro} micro={micro} chosenExercise={chosenExercise!!} />
              )}
              {showPlanned && <PlanningOverview trainingsPlan={trainingsPlan} micro={micro} />}
              {(training?.state === TrainingsState.STARTED || (training?.state === TrainingsState.FINISHED && isEditing)) && chosenExercise && (
                <ExecuteWorkoutInTraining training={training} key={refresHeky} chosenExercise={chosenExercise!!} onSubmit={() => goToNextExercise()} onSubmitSet={() => onSubmitSet()} />
              )}
              {training?.state === TrainingsState.FINISHED && overview && <TrainingsOverview training={training} previousTraining={lastTraining} />}
              {training?.state === TrainingsState.FINISHED && !overview && <TrainingHistory training={training} />}
            </View>
          )}
        </View>
      </ScrollView>
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
