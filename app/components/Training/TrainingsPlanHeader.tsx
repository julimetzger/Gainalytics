import {Text, useTheme} from 'react-native-paper';
import React from 'react';
import {Platform, View} from 'react-native';
import {TrainingsState} from '../../models/TrainingsState';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface headerProps {
  trainingsPlanName: string;
  trainingName: string;
  micro?: number;
  mode: string;
  drawerMenu: React.ReactNode;
}

const TrainingsPlanHeader = ({trainingsPlanName, trainingName, micro, mode, drawerMenu}: headerProps) => {
  let theme = useTheme();
  const safe = useSafeAreaInsets();
  return (
    //TODO 56 dp does only work for android chatgpt says it should be 44 for ios
    <View
      style={{
        marginTop: safe.top,
        marginRight: safe.right,
        marginLeft: safe.left,
        height: Platform.OS === 'android' ? 56 : 44,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: theme.colors.background,
      }}
    >
      {drawerMenu}
      <View style={{flex: 1, justifyContent: 'space-between', alignItems: 'flex-end', flexDirection: 'row'}}>
        <View style={{flexDirection: 'column'}}>
          <Text
            style={{
              fontSize: theme.fonts.titleMedium.fontSize,
              fontWeight: 'bold',
              color: theme.colors.onSecondaryContainer,
            }}
          >
            {trainingsPlanName}
          </Text>
          <View style={{display: 'flex', flexDirection: 'row'}}>
            {micro !== undefined && (
              <Text
                style={{
                  fontSize: 20,
                  color: theme.colors.onSecondaryContainer,
                }}
              >
                Micro {micro}
              </Text>
            )}
            <Text
              style={{
                fontSize: 20,
                color: theme.colors.onSecondaryContainer,
              }}
            >
              {micro !== undefined ? ' ' + trainingName : trainingName}
            </Text>
          </View>
        </View>
        {micro !== undefined && mode !== 'Overview' && (
          <View style={{flexDirection: 'column', width: 80, marginEnd: 10}}>
            <Text style={{fontSize: theme.fonts.titleMedium.fontSize, fontWeight: 'bold', color: theme.colors.onSecondaryContainer}}>Mode</Text>
            <Text
              style={{
                fontSize: 20,
                color: theme.colors.onSecondaryContainer,
              }}
            >
              {mode === undefined && 'Planning'}
              {mode === TrainingsState.PLANNED && 'Planning'}
              {mode === TrainingsState.STARTED && 'Active'}
              {mode === TrainingsState.FINISHED && 'Done'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default TrainingsPlanHeader;
