import {Button, Dialog, Portal, useTheme} from 'react-native-paper';
import React from 'react';
import AddWorkoutSet from "./AddWorkoutSet";

interface EdiotWorkoutSetDialogProps {
    workoutSet?: WorkoutSet,
    visible: boolean,
    setVisible: (bool: boolean) => void,
    onDelete: (workoutSet: WorkoutSet) => void,
    onSubmit: (workoutSet: WorkoutSet) => void
}

const EditWorkoutSetDialog = ({workoutSet, visible, setVisible, onDelete, onSubmit}: EdiotWorkoutSetDialogProps) => {
    let theme = useTheme();
    const hideDialog = () => setVisible(false);

    const confirmDialog = () => {
        setVisible(false);
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={hideDialog} theme={theme} style={{backgroundColor: theme.colors.backdrop}}>
                <Dialog.Title>Edit Workout Set</Dialog.Title>
                <Dialog.Content>
                    <AddWorkoutSet onSubmit={(updatedWorkout) => {
                        onSubmit(updatedWorkout!!);
                        confirmDialog();
                    }} workoutSet={workoutSet}/>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={() => {
                        onDelete(workoutSet!!);
                        confirmDialog();
                    }}>Delete</Button>
                </Dialog.Actions>
                <Dialog.Actions>
                    <Button onPress={hideDialog}>Cancel</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default EditWorkoutSetDialog;
