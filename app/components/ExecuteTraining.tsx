import React, {useEffect, useState} from "react";
import {View} from "react-native";
import AddWorkout from "./AddWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useNextTrainingsId} from "../redux/Training/useNextTrainingsId";
import {Training} from "../models/Training";
import {Exercise} from "../models/Exercise";
import {WorkoutSet} from "../models/WorkoutSet";
import {Dialog, IconButton, Portal} from "react-native-paper";
import WorkoutSetView from "./WorkoutSetView";

const ExecuteTraining = ({training, chosenExercise, onSubmit, onSubmitSet}: Props) => {
    let doneWorkoutId = training.doneWorkoutIds[chosenExercise.id!!];
    let doneWorkout = useWorkoutById(doneWorkoutId);
    let nextTrainingsId = useNextTrainingsId();
    let plannedWorkout = useWorkoutById(training.plannedWorkouts[chosenExercise.id!!]);
    let [open, setOpen] = useState(false);

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
                        info={<IconButton
                            icon={'information-outline'} onPress={() => {
                            setOpen(true)
                        }}></IconButton>}/>
            <Portal>
                <Dialog visible={open} onDismiss={() => setOpen(false)}>
                    <Dialog.Title>Planned workout for {chosenExercise.name}</Dialog.Title>
                    <Dialog.Content>
                        <View>
                            <WorkoutSetView sets={plannedWorkout?.sets ?? []} editable={false}/>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <IconButton icon={'close'} onPress={() => setOpen(false)}></IconButton>
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
