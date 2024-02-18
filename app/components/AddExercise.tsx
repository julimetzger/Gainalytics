import {Button, Dialog, IconButton, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {View} from 'react-native';
import React, {useState} from 'react';
import {useDispatchAddExercise} from '../redux/Exercises/dispatchAddExercise';
import {dispatchEditExercise} from "../redux/Exercises/dispatchEditExercise";
import {useExercise} from "../redux/Exercises/useExercise";
import {dispatchDeleteExercise} from "../redux/Exercises/dispatchDeleteExercise";

interface AddExerciseProperties {
    style?: any,
    exerciseId?: number
}

const AddExercise = ({style, exerciseId}: AddExerciseProperties) => {
    const [visible, setVisible] = React.useState(false);
    const [newExercise, setNewExercise] = useState('');
    const [deleteOverlay, setDeleteOverlay] = useState(false);
    let dispatchAddExercise = useDispatchAddExercise();
    let exercise = exerciseId ? useExercise(exerciseId) : undefined;
    let editExercise = dispatchEditExercise();
    let deleteExercise = dispatchDeleteExercise();
    let theme = useTheme();
    const showDialog = () => setVisible(true);
    const hideDialog = () => {
        setVisible(false)
        setDeleteOverlay(false);
    }
    const confirmDialog = () => {
        setVisible(false);
        exerciseId ? editExercise(exerciseId, newExercise) :
            dispatchAddExercise(newExercise);
    };

    return (
        <View style={style}>
            {exerciseId ? <IconButton icon={'dots-vertical'} onPress={() => showDialog()} theme={theme}/> :
                <IconButton icon="plus-circle" onPress={() => showDialog()} theme={theme}
                            iconColor={theme.colors.tertiaryContainer}
                            size={40}></IconButton>}
            <Portal>
                <Dialog visible={visible} onDismiss={hideDialog} theme={theme}>
                    {!deleteOverlay && exerciseId && <Dialog.Title>{"Edit " + exercise!!.name}</Dialog.Title>}
                    {!deleteOverlay && !exerciseId && <Dialog.Title>Add new Exercise</Dialog.Title>}
                    {deleteOverlay && <Dialog.Title>{"Delete " + exercise!!.name}</Dialog.Title>}
                    <Dialog.Content>
                        {deleteOverlay ?
                            <Text>This action will delete the exercise and all workouts saved for the exercise. Are you sure you want to delete this exercise?</Text>
                            : <TextInput defaultValue={exercise?.name} label={'Name of the Exercise'}
                                         onChangeText={(text) => setNewExercise(text)}/>}
                    </Dialog.Content>
                    <View style={{alignItems: 'center', display: 'flex', justifyContent: 'center'}}>
                        <Dialog.Actions>
                            <Button onPress={hideDialog}>Cancel</Button>
                        </Dialog.Actions>
                        {!deleteOverlay && <Dialog.Actions>
                            <Button onPress={confirmDialog}>Done</Button>
                        </Dialog.Actions>}
                        {exerciseId && <Dialog.Actions>
                            <Button onPress={() => {
                                deleteOverlay ? deleteExercise(exerciseId) : setDeleteOverlay(true);
                            }}>Delete</Button></Dialog.Actions>}
                    </View>
                </Dialog>
            </Portal>
        </View>
    );
};

export default AddExercise;
