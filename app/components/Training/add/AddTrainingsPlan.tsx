import {Button, Dialog, IconButton, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {Alert, View} from 'react-native';
import React, {useState} from 'react';
import {useStore} from 'react-redux';
import {dispatchAddTrainingsPlan} from '../../../redux/Training/dispatch/general/dispatchAddTrainingsPlan';
import {dispatchEditTrainingsPlan} from '../../../redux/Training/dispatch/general/dispatchEditTrainingsPlan';
import {dispatchDeleteTrainingsPlan} from '../../../redux/Training/dispatch/general/dispatchDeleteTrainingsPlan';
import {useTrainingsPlan} from '../../../redux/Training/use/useTrainingsPlan';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import {useDispatchImportTrainingsPlan} from '../../../redux/fullstateactions/dispatchImportTrainingsPlan';
import {exportTrainingsPlanToFile} from '../../../utils/exportTrainingsPlan';
import Toast from 'react-native-toast-message';
import {GlobalState} from '../../../redux/rootReducer';

interface AddExerciseProperties {
  style?: any;
  trainingsId?: number;
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
  let importTrainingsPlan = useDispatchImportTrainingsPlan();
  const store = useStore<GlobalState>();

  const showDialog = () => setVisible(true);
  const hideDialog = () => {
    setVisible(false);
    setDeleteOverlay(false);
  };

  const handleImport = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });
      const fileContent = await RNFS.readFile(res[0].uri, 'utf8');
      const payload = JSON.parse(fileContent);
      importTrainingsPlan(payload);
      hideDialog();
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled the picker
      } else {
        console.error(err);
      }
    }
  };

  const confirmDialog = () => {
    setVisible(false);
    trainingsId ? editTrainingsPlan(trainingsId, TrainingName) : addTrainingsPlan({name: TrainingName} as TrainingsPlan);
  };

  const handleExport = () => {
    if (!trainingsPlan) {
      return;
    }

    exportTrainingsPlanToFile(trainingsPlan, store.getState())
      .then((path) => {
        if (!store.getState().settings?.toggles?.disableToasts) {
          Toast.show({
            type: 'success',
            text1: 'Training plan exported',
            text2: path,
            position: 'top',
            visibilityTime: 4000,
          });
        }
      })
      .catch((error) => {
        console.error('Failed to export training plan', error);
        Alert.alert('Export failed', 'Could not export the training plan.');
      });
  };

  return (
    <View style={style}>
      {trainingsId ? (
        <IconButton icon={'dots-vertical'} onPress={() => showDialog()} theme={theme} testID={`edit-trainings-plan-${trainingsId}`} />
      ) : (
        <IconButton
          icon="plus-circle"
          onPress={() => showDialog()}
          theme={theme}
          iconColor={theme.colors.tertiaryContainer}
          size={40}
          testID="add-trainings-plan"
        ></IconButton>
      )}
      <Portal>
        <Dialog visible={visible} onDismiss={hideDialog} theme={theme}>
          {!deleteOverlay && trainingsId && <Dialog.Title> {'Edit ' + trainingsPlan?.name}</Dialog.Title>}
          {!deleteOverlay && !trainingsId && <Dialog.Title>Add new Training Plan</Dialog.Title>}
          {deleteOverlay && <Dialog.Title>{'Delete ' + trainingsPlan?.name}</Dialog.Title>}
          <Dialog.Content>
            {deleteOverlay ? (
              <Text>
                This action will delete the training. The workouts done in this training will not be deleted and are still available in the history. Are you sure you want to delete this training?
              </Text>
            ) : (
              <TextInput testID="plan-name-input" defaultValue={trainingsPlan?.name} label={'Name of the Training Plan'} maxLength={30} onChangeText={(text) => setTrainingName(text)} />
            )}
          </Dialog.Content>
          {!deleteOverlay && !trainingsId && (
            <Dialog.Actions style={{justifyContent: 'flex-start'}}>
              <Button icon="import" onPress={handleImport}>
                Import Plan
              </Button>
            </Dialog.Actions>
          )}
          {!deleteOverlay && trainingsId && (
            <Dialog.Actions style={{justifyContent: 'flex-start'}}>
              <Button onPress={handleExport}>Export</Button>
            </Dialog.Actions>
          )}
          <Dialog.Actions style={{justifyContent: 'space-between'}}>
            <Button onPress={hideDialog}>Cancel</Button>
            {trainingsId && (
              <Button
                textColor={theme.colors.tertiary}
                onPress={() => {
                  deleteOverlay ? deleteTrainingsPlan(trainingsId) : setDeleteOverlay(true);
                }}
              >
                Delete
              </Button>
            )}
            {!deleteOverlay && <Button testID="confirm-trainings-plan" onPress={confirmDialog}>Done</Button>}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

export default AddTrainingsPlan;
