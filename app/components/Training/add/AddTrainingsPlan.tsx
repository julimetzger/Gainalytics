import {FAB, HelperText, IconButton, TextInput, useTheme} from 'react-native-paper';
import {Alert, Keyboard, View} from 'react-native';
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
import EditDialogScaffold from '../../common/EditDialogScaffold';
import {isValidTrainingsPlanName, trainingsPlanDisplayName} from '../../../utils/trainings-plan-name';

interface AddTrainingsPlanProperties {
  style?: any;
  trainingsId?: number;
}

const AddTrainingsPlan = ({style, trainingsId}: AddTrainingsPlanProperties) => {
  const [visible, setVisible] = React.useState(false);
  const [TrainingName, setTrainingName] = useState('');
  const [nameError, setNameError] = useState(false);
  let addTrainingsPlan = dispatchAddTrainingsPlan();
  let trainingsPlan = trainingsId ? useTrainingsPlan(trainingsId) : undefined;
  let editTrainingsPlan = dispatchEditTrainingsPlan();
  let deleteTrainingsPlan = dispatchDeleteTrainingsPlan();
  let theme = useTheme();
  let importTrainingsPlan = useDispatchImportTrainingsPlan();
  const store = useStore<GlobalState>();

  const showDialog = () => {
    setTrainingName(trainingsPlan?.name ?? '');
    setNameError(false);
    setVisible(true);
  };
  const hideDialog = () => {
    setNameError(false);
    setVisible(false);
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

  // GH-428 (H1): "Save" used to close the dialog and persist whatever was in the
  // field — including nothing at all, which produced a plan the user could not
  // tell apart from any other draft. The dialog now stays open and explains why.
  const confirmDialog = () => {
    if (!isValidTrainingsPlanName(TrainingName)) {
      setNameError(true);
      // The keyboard stays up on purpose: the dialog remains open and the user
      // needs to keep typing the missing name right away.
      return;
    }
    const name = TrainingName.trim();
    setNameError(false);
    // GH-436 usability walk: the dialog closed but the keyboard stayed up over the
    // plan list, hiding the freshly created plan. Only dismiss it once we really save.
    Keyboard.dismiss();
    setVisible(false);
    trainingsId ? editTrainingsPlan(trainingsId, name) : addTrainingsPlan({name} as TrainingsPlan);
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
        <IconButton
          icon={'dots-vertical'}
          onPress={() => showDialog()}
          theme={theme}
          testID={`edit-trainings-plan-${trainingsId}`}
          accessibilityLabel={`Edit ${trainingsPlanDisplayName(trainingsPlan?.name)}`}
        />
      ) : (
        // GH-460: same floating extended FAB as "New Exercise" in the Exercises tab.
        <FAB icon="plus" label="New Training" onPress={() => showDialog()} testID="add-trainings-plan" />
      )}
      <EditDialogScaffold
        visible={visible}
        onDismiss={hideDialog}
        title={trainingsId ? `Edit ${trainingsPlanDisplayName(trainingsPlan?.name)}` : 'Add New Training Plan'}
        testID="trainings-plan-dialog"
        dismissTestID="trainings-plan-cancel"
        primaryAction={{label: 'Save', onPress: confirmDialog, testID: 'confirm-trainings-plan'}}
        secondaryActions={
          trainingsId
            ? [{label: 'Export', icon: 'export', onPress: handleExport}]
            : [{label: 'Import Plan', icon: 'import', onPress: handleImport}]
        }
        destructiveAction={
          trainingsId
            ? {
                label: 'Delete Plan',
                onConfirm: () => deleteTrainingsPlan(trainingsId),
                confirmTitle: `Delete ${trainingsPlanDisplayName(trainingsPlan?.name)}`,
                confirmMessage:
                  'This action will delete the training. The workouts done in this training will not be deleted and are still available in the history. Are you sure you want to delete this training?',
                confirmLabel: 'Delete',
                testID: 'trainings-plan-delete',
                confirmTestID: 'trainings-plan-delete-confirm',
                cancelTestID: 'trainings-plan-delete-cancel',
                dialogTestID: 'trainings-plan-delete-dialog',
              }
            : undefined
        }
      >
        <TextInput
          testID="plan-name-input"
          mode="outlined"
          value={TrainingName}
          label={'Name of the Training Plan'}
          maxLength={30}
          error={nameError}
          onChangeText={(text) => {
            if (nameError) {
              setNameError(false);
            }
            setTrainingName(text);
          }}
        />
        <HelperText type="error" visible={nameError} testID="plan-name-error">
          Please enter a name for the training plan.
        </HelperText>
      </EditDialogScaffold>
    </View>
  );
};

export default AddTrainingsPlan;
