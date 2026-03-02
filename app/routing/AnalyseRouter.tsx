import React from 'react';
import History from '../tabs/Analyse/History';
import {Exercise} from '../models/entities/Exercise';
import {createDrawerNavigator} from '@react-navigation/drawer';
import AnalyseGraphics from '../tabs/Analyse/AnalyseGraphics';
import RecordsTab from '../tabs/Analyse/Records';
import MetricsTab from '../tabs/Analyse/Metrics';
import GraphsTab from '../tabs/Analyse/GraphsTab';
import {useTheme} from 'react-native-paper';
import VideoAnalysisTab from '../tabs/Analyse/VideoAnalysisTab';
import VideoAnalysisDetailTab from '../tabs/Analyse/VideoAnalysisDetailTab';

export type RootStackParamList = {
  History: {exercise: Exercise; lowerRangeBound: Date | undefined};
  Analyse: {exercise: {name: string}};
  Records: undefined;
  Metrics: undefined;
  Graphs: undefined;
  VideoAnalyses: undefined;
  VideoAnalysisDetail: {analysisId: number};
};

const AnalyseRouter = () => {
  const Stack = createDrawerNavigator<RootStackParamList>();
  let theme = useTheme();

  return (
    <Stack.Navigator initialRouteName="Analyse" screenOptions={{headerTintColor: theme.colors.onSecondaryContainer}}>
      <Stack.Screen
        name="Analyse"
        component={AnalyseGraphics}
        options={({route}) => ({
          title: route.params?.exercise?.name ?? 'Analyse',
        })}
      />
      <Stack.Screen
        name="Graphs"
        component={GraphsTab}
        options={() => ({
          title: 'Exercise Graphs',
        })}
      />
      <Stack.Screen
        name="History"
        component={History}
        options={({route}) => ({
          title: route.params?.exercise?.name ?? 'History',
        })}
      />
      <Stack.Screen
        name="Metrics"
        component={MetricsTab}
        options={() => ({
          title: 'Metrics Overview',
        })}
      />
      <Stack.Screen
        name="Records"
        component={RecordsTab}
        options={() => ({
          title: 'Records',
        })}
      />
      <Stack.Screen
        name="VideoAnalyses"
        component={VideoAnalysisTab}
        options={() => ({
          title: 'Video Analyses',
        })}
      />
      <Stack.Screen
        name="VideoAnalysisDetail"
        component={VideoAnalysisDetailTab}
        options={() => ({
          title: 'Video Analysis Detail',
        })}
      />
    </Stack.Navigator>
  );
};

export default AnalyseRouter;
