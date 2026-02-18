import React, {useEffect, useState} from 'react';
import {Dimensions, View} from 'react-native';
import AddWorkout from '../../Workout/add/AddWorkout';
import {useWorkoutById} from '../../../redux/Workout/use/useWorkoutById';
import {useNextTrainingsId} from '../../../redux/Training/use/useNextTrainingsId';
import {Training} from '../../../models/entities/Training';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Dialog, IconButton, Portal, Text, Tooltip} from 'react-native-paper';
import WorkoutSetView from '../../Workout/show/WorkoutSetView';
import ExerciseHistory from '../../exercise/show/ExerciseHistory';

const ExecuteTraining = ({training, chosenExercise, onSubmit, onSubmitSet}: Props) => {
  let doneWorkoutId = training.doneWorkoutIds[chosenExercise.id!!];
  let doneWorkout = useWorkoutById(doneWorkoutId);
  let nextTrainingsId = useNextTrainingsId();
  let plannedWorkout = useWorkoutById(training.plannedWorkouts[chosenExercise.id!!]);
  let [openPlanned, setOpenPlanned] = useState(false);
  let [openHistory, setOpenHistory] = useState(false);

  const screenHeight = Dimensions.get('window').height;
  const [date, setDate] = useState(new Date(Date.now()));
  useEffect(() => {}, [chosenExercise]);
  return (
    <View>
      <AddWorkout
        workout={doneWorkout?.end ? doneWorkout : undefined}
        exercise={chosenExercise}
        onSubmit={onSubmit}
        suggest={false}
        trainingsId={training.id ?? nextTrainingsId}
        onSubmitSet={onSubmitSet}
        date={date}
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
          </View>
        }
      />
      <Portal>
        <Dialog visible={openPlanned} onDismiss={() => setOpenPlanned(false)}>
          <Dialog.Title>Planned Workout for {chosenExercise.name}</Dialog.Title>
          <Dialog.Content>
            <View>
              {(plannedWorkout?.sets ?? []).length > 0 ? (
                <WorkoutSetView sets={plannedWorkout?.sets ?? []} editable={false} />
              ) : (
                <Text style={{textAlign: 'center', padding: 20}}>No workout planned for {chosenExercise.name}</Text>
              )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <IconButton icon={'close'} onPress={() => setOpenPlanned(false)}></IconButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog style={{maxHeight: screenHeight * 0.95}} visible={openHistory} onDismiss={() => setOpenHistory(false)}>
          <Dialog.Title numberOfLines={1}>History for {chosenExercise.name}</Dialog.Title>
          <Dialog.Content style={{marginHorizontal: -20}}>
            <View style={{maxHeight: screenHeight * 0.75}}>
              <ExerciseHistory exercise={chosenExercise} editable={false} />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <IconButton icon={'close'} onPress={() => setOpenHistory(false)}></IconButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

interface Props {
  training: Training;
  chosenExercise: Exercise;
  onSubmit: () => void;
  onSubmitSet?: (workoutSet: WorkoutSet) => void;
}

export default ExecuteTraining;
