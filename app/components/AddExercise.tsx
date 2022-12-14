import {Button, Dialog, IconButton, Portal, TextInput, useTheme} from 'react-native-paper';
import {StyleSheet, View} from 'react-native';
import React, {useState} from 'react';
import {useDispatchAddExercise} from '../redux/Exercises/dispatchAddExercise';

const AddExercise = () => {
    const [visible, setVisible] = React.useState(false);
    const [newExercise, setNewExercise] = useState('');
    let dispatchAddExercise = useDispatchAddExercise();
    let theme = useTheme();

    const showDialog = () => setVisible(true);

    const hideDialog = () => setVisible(false);

    const confirmDialog = () => {
        setVisible(false);
        dispatchAddExercise(newExercise);
    };

    return (
        <View style={style.addExerxise}>
            <IconButton icon="plus-circle" onPress={() => showDialog()} theme={theme} color={theme.colors.accent}
                        size={40}></IconButton>
            <Portal>
                <Dialog visible={visible} onDismiss={hideDialog} theme={theme}
                        style={{backgroundColor: theme.colors.backdrop}}>
                    <Dialog.Title>Add new Exercise</Dialog.Title>
                    <Dialog.Content>
                        <TextInput label={'Name of the Exercise'} onChangeText={(text) => setNewExercise(text)}/>
                    </Dialog.Content>
                    <View style={{alignItems: 'center', display: 'flex', justifyContent: 'center'}}>
                        <Dialog.Actions>
                            <Button onPress={hideDialog}>Cancel</Button>
                        </Dialog.Actions>
                        <Dialog.Actions>
                            <Button onPress={confirmDialog}>Done</Button>
                        </Dialog.Actions>
                    </View>
                </Dialog>
            </Portal>
        </View>
    );
};

let style = StyleSheet.create({
    addExerxise: {
        position: 'absolute',
        bottom: 5,
        right: 5
    }
});

export default AddExercise;
