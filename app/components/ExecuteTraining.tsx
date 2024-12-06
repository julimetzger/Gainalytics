import React, {useEffect, useState} from "react";
import {Dimensions, View} from "react-native";
import AddWorkout from "./AddWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useNextTrainingsId} from "../redux/Training/useNextTrainingsId";
import {Training} from "../models/Training";
import {Exercise} from "../models/Exercise";
import {WorkoutSet} from "../models/WorkoutSet";
import {Dialog, IconButton, Portal, Tooltip} from "react-native-paper";
import WorkoutSetView from "./WorkoutSetView";
import ExerciseHistory from "./ExerciseHistory";

const ExecuteTraining = ({training, chosenExercise, onSubmit, onSubmitSet}: Props) => {
    let doneWorkoutId = training.doneWorkoutIds[chosenExercise.id!!];
    let doneWorkout = useWorkoutById(doneWorkoutId);
    let nextTrainingsId = useNextTrainingsId();
    let plannedWorkout = useWorkoutById(training.plannedWorkouts[chosenExercise.id!!]);
    let [openPlanned, setOpenPlanned] = useState(false);
    let [openHistory, setOpenHistory] = useState(false);

    const screenHeight = Dimensions.get('window').height;
    const [date, setDate] = useState(new Date(Date.now()))
    useEffect(() => {
    }, [chosenExercise]);
    return (
        <View>
            <AddWorkout workout={doneWorkout?.end ? doneWorkout : undefined} exercise={chosenExercise}
                        onSubmit={onSubmit}
                        suggest={false}
                        trainingsId={training.id ?? nextTrainingsId}
                        onSubmitSet={onSubmitSet}
                        date={date}
                        info={
                            <View style={{display: 'flex', flexDirection: 'row'}}>
                                <Tooltip 
                                    enterTouchDelay={300}
                                    title='Shows Exercise History'>
                                    <IconButton
                                        icon="history"
                                        onPress={() => {
                                            setOpenHistory(true)
                                        }}>
                                    </IconButton>
                                </Tooltip>
                                <Tooltip 
                                    enterTouchDelay={300}
                                    title='Shows Planned Training'>
                                    <IconButton
                                        icon="book-open-variant"
                                        onPress={() => {
                                            setOpenPlanned(true)
                                        }}>
                                    </IconButton>
                                </Tooltip>
                            </View>}/>
            <Portal>
                <Dialog visible={openPlanned} onDismiss={() => setOpenPlanned(false)}>
                    <Dialog.Title>Planned workout for {chosenExercise.name}</Dialog.Title>
                    <Dialog.Content>
                        <View>
                            <WorkoutSetView sets={plannedWorkout?.sets ?? []} editable={false}/>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <IconButton icon={'close'} onPress={() => setOpenPlanned(false)}></IconButton>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            <Portal>
                <Dialog style={{maxHeight: screenHeight * 0.95}} visible={openHistory}
                        onDismiss={() => setOpenHistory(false)}>
                    <Dialog.Title numberOfLines={1}>History for {chosenExercise.name}</Dialog.Title>
                    <Dialog.Content>
                        <View style={{maxHeight: screenHeight * 0.75}}>
                            <ExerciseHistory exercise={chosenExercise} editable={false}/>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <IconButton icon={'close'} onPress={() => setOpenHistory(false)}></IconButton>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

interface Props {
    training: Training,
    chosenExercise
        :
        Exercise,
    onSubmit
        :
        () => void,
    onSubmitSet?: (workoutSet: WorkoutSet) => void

}

export default ExecuteTraining;
