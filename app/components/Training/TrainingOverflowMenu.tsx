import React from 'react';
import {Dimensions, Pressable, StyleSheet} from 'react-native';
import {Divider, Menu, Portal, Text, useTheme} from 'react-native-paper';
import {TrainingsState} from '../../models/TrainingsState';
import {SubTab} from './TrainingModeTabs';

// GH-401 (H1/AC2): the menu no longer offers "Start Training". That label used to
// exist three times in one flow (dashboard card, Train tab, this menu) with two
// different meanings. The single real start control now lives in the Train tab.
interface TrainingOverflowMenuProps {
  visible: boolean;
  onDismiss: () => void;
  trainingState?: string;
  activeSubTab?: SubTab;
  onFinish: () => void;
  onEditPlan: () => void;
  onEditTraining: () => void;
  onDeleteTraining: () => void;
  /** GH-442: true only for the plan's most recently planned, not-yet-started training. */
  canClearPlan?: boolean;
  onClearPlan?: () => void;
}

const TrainingOverflowMenu = ({
  visible,
  onDismiss,
  trainingState,
  activeSubTab,
  onFinish,
  onEditPlan,
  onEditTraining,
  onDeleteTraining,
  canClearPlan = false,
  onClearPlan,
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
            {canClearPlan && onClearPlan && (
              <Menu.Item
                testID="overflow-clear-plan"
                leadingIcon="broom"
                title="Clear planned training"
                onPress={() => {
                  onDismiss();
                  onClearPlan();
                }}
              />
            )}
            <Divider />
          </>
        ) : (
          <>
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
            title={<Text style={primaryStyle.errorLabel}>{planMenu ? 'Delete this Training' : 'Delete'}</Text>}
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
