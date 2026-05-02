import React from 'react';
import {Dimensions, Pressable, StyleSheet} from 'react-native';
import {Divider, Menu, Portal, Text, useTheme} from 'react-native-paper';
import {TrainingsState} from '../../models/TrainingsState';
import {SubTab} from './TrainingModeTabs';

interface TrainingOverflowMenuProps {
  visible: boolean;
  onDismiss: () => void;
  trainingState?: string;
  activeSubTab?: SubTab;
  onStart: () => void;
  onFinish: () => void;
  onEditPlan: () => void;
  onEditTraining: () => void;
  onDeleteTraining: () => void;
}

const TrainingOverflowMenu = ({
  visible,
  onDismiss,
  trainingState,
  activeSubTab,
  onStart,
  onFinish,
  onEditPlan,
  onEditTraining,
  onDeleteTraining,
}: TrainingOverflowMenuProps) => {
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const planMenu = activeSubTab === 'plan' && trainingState === TrainingsState.PLANNED;

  const primaryStyle = StyleSheet.create({
    label: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    errorLabel: {
      color: theme.colors.error,
      fontWeight: '600',
    },
  });

  return (
    <Portal>
      {visible && <Pressable testID="overflow-scrim" style={primaryStyle.scrim} onPress={onDismiss} />}
      <Menu visible={visible} onDismiss={onDismiss} anchor={{x: screenWidth - 12, y: 60}}>
        {planMenu ? (
          <>
            <Menu.Item
              testID="overflow-edit-plan"
              leadingIcon="pencil-outline"
              title={<Text style={primaryStyle.label}>Edit plan</Text>}
              onPress={() => {
                onDismiss();
                onEditPlan();
              }}
            />
            <Divider />
          </>
        ) : (
          <>
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
          </>
        )}
        {(trainingState === TrainingsState.PLANNED || trainingState === TrainingsState.STARTED || trainingState === TrainingsState.FINISHED) && (
          <Menu.Item
            testID="overflow-discard"
            title={<Text style={primaryStyle.errorLabel}>{planMenu ? 'Discard this training' : 'Discard'}</Text>}
            onPress={() => {
              onDismiss();
              onDeleteTraining();
            }}
          />
        )}
      </Menu>
    </Portal>
  );
};

export default TrainingOverflowMenu;
