import {Button, Dialog, IconButton, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {View} from 'react-native';
import React, {useState} from 'react';
import {dispatchAddTrainingsPlan} from "../../redux/Training/dispatchAddTrainingsPlan";
import {dispatchEditTrainingsPlan} from "../../redux/Training/dispatchEditTrainingsPlan";
import {dispatchDeleteTrainingsPlan} from "../../redux/Training/dispatchDeleteTrainingsPlan";
import {useAllTrainingsPlans} from "../../redux/Training/useTrainingsPlan";

interface AddExerciseProperties {
    style?: any,
    trainingsId?: number
}

const AddTrainingsPlan = ({style, trainingsId}: AddExerciseProperties) => {
    const [visible, setVisible] = React.useState(false);
    const [traingName, setTraingName] = useState('');
    const [deleteOverlay, setDeleteOverlay] = useState(false);
    let addTrainingsPlan = dispatchAddTrainingsPlan();
    let trainingsPlan = trainingsId ? useAllTrainingsPlans(trainingsId) : undefined;
    let editTrainingsPlan = dispatchEditTrainingsPlan();
    let deleteTrainingsPlan = dispatchDeleteTrainingsPlan();
    let theme = useTheme();
    const showDialog = () => setVisible(true);
    const hideDialog = () => {
        setVisible(false)
        setDeleteOverlay(false);
    }
    const confirmDialog = () => {
        setVisible(false);
        trainingsId ? editTrainingsPlan(trainingsId, traingName) :
            addTrainingsPlan({name: traingName} as TrainingsPlan);
    };

    return (
        <View style={style}>
            {trainingsId ? <IconButton icon={'dots-vertical'} onPress={() => showDialog()} theme={theme}/> :
                <IconButton icon="plus-circle" onPress={() => showDialog()} theme={theme}
                            iconColor={theme.colors.tertiaryContainer}
                            size={40}></IconButton>}
            <Portal>
                <Dialog visible={visible} onDismiss={hideDialog} theme={theme}>
                    {!deleteOverlay && trainingsId && < Dialog.Title> {"Edit " + trainingsPlan!!.name}</Dialog.Title>}
                    {!deleteOverlay && !trainingsId && <Dialog.Title>Add new trainings plan</Dialog.Title>}
                    {deleteOverlay && <Dialog.Title>{"Delete " + trainingsPlan!!.name}</Dialog.Title>}
                    <Dialog.Content>
                        {deleteOverlay ?
                            <Text>This action will delete the training and all workouts saved for the training. Are you
                                sure you want to delete this training?</Text>
                            : <TextInput defaultValue={trainingsPlan?.name} label={'Name of the trainings plan'}
                                         onChangeText={(text) => setTraingName(text)}/>}
                    </Dialog.Content>
                    <View style={{alignItems: 'center', display: 'flex', justifyContent: 'center'}}>
                        <Dialog.Actions>
                            <Button onPress={hideDialog}>Cancel</Button>
                        </Dialog.Actions>
                        {!deleteOverlay && <Dialog.Actions>
                            <Button onPress={confirmDialog}>Done</Button>
                        </Dialog.Actions>}
                        {trainingsId && <Dialog.Actions>
                            <Button onPress={() => {
                                deleteOverlay ? deleteTrainingsPlan(trainingsId) : setDeleteOverlay(true);
                            }}>Delete</Button></Dialog.Actions>}
                    </View>
                </Dialog>
            </Portal>
        </View>
    );
};

export default AddTrainingsPlan;
