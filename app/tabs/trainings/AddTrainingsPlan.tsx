import {Button, Dialog, IconButton, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {View} from 'react-native';
import React, {useState} from 'react';
import {dispatchAddTrainingsPlan} from "../../redux/Training/dispatchAddTrainingsPlan";
import {dispatchEditTrainingsPlan} from "../../redux/Training/dispatchEditTrainingsPlan";
import {dispatchDeleteTrainingsPlan} from "../../redux/Training/dispatchDeleteTrainingsPlan";
import {useTrainingsPlan} from "../../redux/Training/useTrainingsPlan";
import {TrainingsPlan} from "../../models/TrainingsPlan";

interface AddExerciseProperties {
    style?: any,
    trainingsId?: number
}

const AddTrainingsPlan = ({style, trainingsId}: AddExerciseProperties) => {
    const [visible, setVisible] = React.useState(false);
    const [TrainingName, setTrainingName] = useState('');
    const [deleteOverlay, setDeleteOverlay] = useState(false);
    let addTrainingsPlan = dispatchAddTrainingsPlan();
    let trainingsPlan = trainingsId ? useTrainingsPlan(trainingsId) : undefined;
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
        trainingsId ? editTrainingsPlan(trainingsId, TrainingName) :
            addTrainingsPlan({name: TrainingName} as TrainingsPlan);
    };

    return (
        <View style={style}>
            {trainingsId ? <IconButton icon={'dots-vertical'} onPress={() => showDialog()} theme={theme}/> :
                <IconButton icon="plus-circle" onPress={() => showDialog()} theme={theme}
                            iconColor={theme.colors.tertiaryContainer}
                            size={40}></IconButton>}
            <Portal>
                <Dialog visible={visible} onDismiss={hideDialog} theme={theme}>
                    {!deleteOverlay && trainingsId && < Dialog.Title> {"Edit " + trainingsPlan?.name}</Dialog.Title>}
                    {!deleteOverlay && !trainingsId && <Dialog.Title>Add new Training Plan</Dialog.Title>}
                    {deleteOverlay && <Dialog.Title>{"Delete " + trainingsPlan?.name}</Dialog.Title>}
                    <Dialog.Content>
                        {deleteOverlay ?
                            <Text>This action will delete the training. The workouts done in this training will not be deleted and are still available in the history. Are you
                                sure you want to delete this training?</Text>
                            : <TextInput defaultValue={trainingsPlan?.name}
                                         label={'Name of the Training Plan'}
                                         maxLength={30}
                                         onChangeText={(text) => setTrainingName(text)}/>}
                    </Dialog.Content>
                    <Dialog.Actions style={{justifyContent: 'space-between'}}>
                        <Button onPress={hideDialog}>Cancel</Button>
                        {trainingsId && (
                            <Button textColor={theme.colors.tertiary} onPress={() => {
                                deleteOverlay ? deleteTrainingsPlan(trainingsId) : setDeleteOverlay(true);
                            }}>Delete</Button>
                        )}
                        {!deleteOverlay && (
                            <Button onPress={confirmDialog}>Done</Button>
                        )}
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

export default AddTrainingsPlan;
