import {Badge, Button, Dialog, Portal, TextInput} from 'react-native-paper';
import {View} from 'react-native';
import React, {useState} from 'react';
import {bindActionCreators, Dispatch} from 'redux';
import {addExercise} from '../redux/Exercises/addExercise';
import {connect} from 'react-redux';

const AddExercise = (props: OwnProps) => {
  const [visible, setVisible] = React.useState(false);
  const [newExercise, setNewExercise] = useState('');

  const showDialog = () => setVisible(true);

  const hideDialog = () => setVisible(false);

  const confirmDialog = () => {
    setVisible(false);
    props.addExercise(newExercise);
  };

  return (
    <View>
      <Badge size={35} onPress={() => showDialog()}>
        +
      </Badge>
      <Portal>
        <Dialog visible={visible} onDismiss={hideDialog}>
          <Dialog.Title>Add new Exercise</Dialog.Title>
          <Dialog.Content>
            <TextInput label={'Name of the Exercise'} onChangeText={(text) => setNewExercise(text)} />
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

const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      addExercise,
    },
    dispatch,
  );

interface OwnProps {
  addExercise: typeof addExercise;
}

export default connect(null, mapDispatchToProps)(AddExercise);
