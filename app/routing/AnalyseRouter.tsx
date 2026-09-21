import React from 'react';
import History from '../tabs/Analyse/History';
import {Exercise} from '../models/entities/Exercise';
import {createDrawerNavigator} from '@react-navigation/drawer';
import AnalyseGraphics from '../tabs/Analyse/AnalyseGraphics';
import RecordsTab from '../tabs/Analyse/Records';
import MetricsTab from '../tabs/Analyse/Metrics';
import {IconButton, useTheme} from 'react-native-paper';
import VideoAnalysisTab from '../tabs/Analyse/VideoAnalysisTab';
import VideoAnalysisDetailTab from '../tabs/Analyse/VideoAnalysisDetailTab';
import VideoAnalysisCompareTab from '../tabs/Analyse/VideoAnalysisCompareTab';
import TrainingLengthTab from '../tabs/Analyse/TrainingLengthTab';
import DashboardTab from '../tabs/Analyse/DashboardTab';
import AIChatTab from '../tabs/Analyse/AIChatTab';
import ChatHistoryTab from '../tabs/Analyse/ChatHistoryTab';
import {withAnalyseErrorBoundary} from '../components/analyse/AnalyseErrorBoundary';

export type RootStackParamList = {
  Dashboard: undefined;
  History: {exercise: Exercise; lowerRangeBound: Date | undefined};
  AnalyseHome: {exercise: {name: string}};
  Records: undefined;
  Metrics: undefined;
  TrainingLength: undefined;
  VideoAnalyses: undefined;
  VideoAnalysisDetail: {analysisId: number};
  VideoAnalysisCompare: {analysisId: number; compareAnalysisId: number};
  AIChat: undefined;
  ChatHistory: undefined;
};

// GH-458 (H1): every Analyse screen renders behind its own error boundary, so a
// render error degrades to a card inside the screen instead of unmounting the
// navigator. Built once at module level — building them inside the component
// would hand React a new component type on every render and remount each screen.
const DashboardScreen = withAnalyseErrorBoundary(DashboardTab, 'Dashboard');
const AnalyseGraphicsScreen = withAnalyseErrorBoundary(AnalyseGraphics, 'Analyse');
const TrainingLengthScreen = withAnalyseErrorBoundary(TrainingLengthTab, 'Training Length');
const HistoryScreen = withAnalyseErrorBoundary(History, 'History');
const MetricsScreen = withAnalyseErrorBoundary(MetricsTab, 'Metrics Overview');
const RecordsScreen = withAnalyseErrorBoundary(RecordsTab, 'Records');
const VideoAnalysesScreen = withAnalyseErrorBoundary(VideoAnalysisTab, 'Video Analyses');
const VideoAnalysisDetailScreen = withAnalyseErrorBoundary(VideoAnalysisDetailTab, 'Video Analysis Detail');
const VideoAnalysisCompareScreen = withAnalyseErrorBoundary(VideoAnalysisCompareTab, 'Compare Analyses');
const AIChatScreen = withAnalyseErrorBoundary(AIChatTab, 'AI Chat');
const ChatHistoryScreen = withAnalyseErrorBoundary(ChatHistoryTab, 'Chat History');

// GH-458 (H1/H2): "Video Analysis Detail" and "Compare Analyses" are detail
// screens that need a selection made in the Video Analyses list. Offering them
// as standalone drawer entries put every user one tap away from a white screen
// (Detail) or a dead end (Compare). The routes stay registered and reachable
// from the list; only the drawer entries are hidden.
export const ANALYSE_DRAWER_HIDDEN_ROUTES = ['VideoAnalysisDetail', 'VideoAnalysisCompare'] satisfies (keyof RootStackParamList)[];

export const getAnalyseDrawerItemOptions = (routeName: keyof RootStackParamList) =>
  ANALYSE_DRAWER_HIDDEN_ROUTES.some((hiddenRoute) => hiddenRoute === routeName) ? {drawerItemStyle: {display: 'none' as const}} : {};

const AnalyseRouter = () => {
  const Stack = createDrawerNavigator<RootStackParamList>();
  let theme = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      backBehavior="history"
      screenOptions={({navigation}) => ({
        headerTintColor: theme.colors.onSecondaryContainer,
        headerLeft: () => <IconButton icon="menu" testID="analyse-drawer-toggle" onPress={() => navigation.toggleDrawer()} />,
        // GH-313 background-render guard. The drawer keeps every screen mounted, so
        // unfocused screens (Dashboard, Records, History, Metrics, TrainingLength, …)
        // re-ran their selectors and memos on every store dispatch. freezeOnBlur lets
        // react-native-screens wrap each off-screen subtree with react-freeze, which
        // suspends rendering until the screen is focused again. Same mechanism as the
        // explicit <Freeze> guard from GH-284.
        freezeOnBlur: true,
      })}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={() => ({
          title: 'Dashboard',
        })}
      />
      <Stack.Screen
        name="AnalyseHome"
        component={AnalyseGraphicsScreen}
        options={({route}) => ({
          title: route.params?.exercise?.name ?? 'Analyse',
        })}
      />
      <Stack.Screen
        name="TrainingLength"
        component={TrainingLengthScreen}
        options={() => ({
          title: 'Training Length',
        })}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={({route}) => ({
          title: route.params?.exercise?.name ?? 'History',
        })}
      />
      <Stack.Screen
        name="Metrics"
        component={MetricsScreen}
        options={() => ({
          title: 'Metrics Overview',
        })}
      />
      <Stack.Screen
        name="Records"
        component={RecordsScreen}
        options={() => ({
          title: 'Records',
        })}
      />
      <Stack.Screen
        name="VideoAnalyses"
        component={VideoAnalysesScreen}
        options={() => ({
          title: 'Video Analyses',
        })}
      />
      <Stack.Screen
        name="VideoAnalysisDetail"
        component={VideoAnalysisDetailScreen}
        options={() => ({
          title: 'Video Analysis Detail',
          ...getAnalyseDrawerItemOptions('VideoAnalysisDetail'),
        })}
      />
      <Stack.Screen
        name="VideoAnalysisCompare"
        component={VideoAnalysisCompareScreen}
        options={() => ({
          title: 'Compare Analyses',
          ...getAnalyseDrawerItemOptions('VideoAnalysisCompare'),
        })}
      />
      <Stack.Screen
        name="AIChat"
        component={AIChatScreen}
        options={() => ({
          title: 'AI Chat',
          drawerIcon: ({color, size}: {color: string; size: number}) => (
            <IconButton icon="chat-processing-outline" iconColor={color} size={size} />
          ),
        })}
      />
      <Stack.Screen
        name="ChatHistory"
        component={ChatHistoryScreen}
        options={() => ({
          title: 'Chat History',
          drawerIcon: ({color, size}: {color: string; size: number}) => (
            <IconButton icon="history" iconColor={color} size={size} />
          ),
        })}
      />
    </Stack.Navigator>
  );
};

export default AnalyseRouter;
