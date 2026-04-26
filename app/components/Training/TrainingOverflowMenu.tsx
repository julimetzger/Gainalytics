import React from 'react';
import {Dimensions, StyleSheet} from 'react-native';
import {Menu, Text, useTheme} from 'react-native-paper';
import {TrainingsState} from '../../models/TrainingsState';

interface TrainingOverflowMenuProps {
  visible: boolean;
  onDismiss: () => void;
  trainingState?: string;
  onStart: () => void;
  onFinish: () => void;
  onEditTraining: () => void;
  onDeleteTraining: () => void;
}

const TrainingOverflowMenu = ({
  visible,
  onDismiss,
  trainingState,
  onStart,
  onFinish,
  onEditTraining,
  onDeleteTraining,
}: TrainingOverflowMenuProps) => {
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width;

  const primaryStyle = StyleSheet.create({
    label: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
  });

  return (
    <Menu visible={visible} onDismiss={onDismiss} anchor={{x: screenWidth, y: 60}}>
      {trainingState === TrainingsState.PLANNED && (
        <Menu.Item
          testID="overflow-start"
          title={<Text style={primaryStyle.label}>Start Training</Text>}
          onPress={() => {
            onDismiss();
            onStart();
          }}
        />
      )}
      {trainingState === TrainingsState.STARTED && (
        <Menu.Item
          testID="overflow-finish"
          title={<Text style={primaryStyle.label}>Finish Training</Text>}
          onPress={() => {
            onDismiss();
            onFinish();
          }}
        />
      )}
      {trainingState === TrainingsState.STARTED && (
        // TODO: implement pause session functionality
        <Menu.Item
          testID="overflow-pause"
          title="Pause session"
          disabled
          onPress={() => {}}
        />
      )}
      {(trainingState === TrainingsState.PLANNED || trainingState === TrainingsState.STARTED || trainingState === TrainingsState.FINISHED) && (
        <Menu.Item
          testID="overflow-edit"
          title="Edit training"
          onPress={() => {
            onDismiss();
            onEditTraining();
          }}
        />
      )}
      {(trainingState === TrainingsState.PLANNED || trainingState === TrainingsState.STARTED || trainingState === TrainingsState.FINISHED) && (
        <Menu.Item
          testID="overflow-discard"
          title="Discard"
          onPress={() => {
            onDismiss();
            onDeleteTraining();
          }}
        />
      )}
    </Menu>
  );
};

export default TrainingOverflowMenu;
