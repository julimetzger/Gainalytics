import React from 'react';
import History from '../tabs/Analyse/History';
import {Exercise} from '../models/entities/Exercise';
import {Muscles} from '../models/Muscles';
import {createDrawerNavigator} from '@react-navigation/drawer';
import AnalyseGraphics from '../tabs/Analyse/AnalyseGraphics';
import RecordsTab from '../tabs/Analyse/Records';
import MetricsTab from '../tabs/Analyse/Metrics';
import {IconButton, MD3Theme, useTheme} from 'react-native-paper';
import VideoAnalysisTab from '../tabs/Analyse/VideoAnalysisTab';
import VideoAnalysisDetailTab from '../tabs/Analyse/VideoAnalysisDetailTab';
import VideoAnalysisCompareTab from '../tabs/Analyse/VideoAnalysisCompareTab';
import TrainingLengthTab from '../tabs/Analyse/TrainingLengthTab';
import BodyWeightTab from '../tabs/Analyse/BodyWeightTab';
import DashboardTab from '../tabs/Analyse/DashboardTab';
import AIChatTab from '../tabs/Analyse/AIChatTab';
import ChatHistoryTab from '../tabs/Analyse/ChatHistoryTab';
import {withAnalyseErrorBoundary} from '../components/analyse/AnalyseErrorBoundary';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export type RootStackParamList = {
  Dashboard: undefined;
  History: {exercise: Exercise; lowerRangeBound: Date | undefined};
  AnalyseHome: {exercise: {name: string}};
  Records: undefined;
  // GH-458 (H4): the dashboard's muscle chips drill down into this screen. The
  // muscle and the range travel as params — navigation params must stay
  // serializable, so the range is passed as two epoch-millisecond numbers.
  Metrics: {muscle?: Muscles; rangeStartMs?: number; rangeEndMs?: number; drilldownNonce?: number} | undefined;
  TrainingLength: undefined;
  BodyWeight: undefined;
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
const BodyWeightScreen = withAnalyseErrorBoundary(BodyWeightTab, 'Body Weight');
const HistoryScreen = withAnalyseErrorBoundary(History, 'History');
const MetricsScreen = withAnalyseErrorBoundary(MetricsTab, 'Metrics Overview');
const RecordsScreen = withAnalyseErrorBoundary(RecordsTab, 'Records');
const VideoAnalysesScreen = withAnalyseErrorBoundary(VideoAnalysisTab, 'Video Analysis');
const VideoAnalysisDetailScreen = withAnalyseErrorBoundary(VideoAnalysisDetailTab, 'Video Analysis Detail');
const VideoAnalysisCompareScreen = withAnalyseErrorBoundary(VideoAnalysisCompareTab, 'Compare Analyses');
const AIChatScreen = withAnalyseErrorBoundary(AIChatTab, 'AI Chat');
const ChatHistoryScreen = withAnalyseErrorBoundary(ChatHistoryTab, 'Chat History');

// GH-458 (H1/H2): "Video Analysis Detail" and "Compare Analyses" are detail
// screens that need a selection made in the Video Analysis list. Offering them
// as standalone drawer entries put every user one tap away from a white screen
// (Detail) or a dead end (Compare). The routes stay registered and reachable
// from the list; only the drawer entries are hidden.
export const ANALYSE_DRAWER_HIDDEN_ROUTES = ['VideoAnalysisDetail', 'VideoAnalysisCompare'] satisfies (keyof RootStackParamList)[];

export const getAnalyseDrawerItemOptions = (routeName: keyof RootStackParamList) =>
  ANALYSE_DRAWER_HIDDEN_ROUTES.some((hiddenRoute) => hiddenRoute === routeName) ? {drawerItemStyle: {display: 'none' as const}} : {};

// GH-484: the drawer's JS header reads `fonts.medium` from the navigation theme,
// which the Paper MD3 theme does not have — so every Analyse title (Dashboard
// first) rendered in regular weight, while the native-stack headers of
// Training, Exercises and Settings use the platform's medium title font. Pin the
// Analyse titles to the same medium face; the header keeps its own font size.
export const getAnalyseHeaderTitleStyle = (fonts: MD3Theme['fonts']) => ({
  fontFamily: fonts.titleMedium.fontFamily,
  fontWeight: fonts.titleMedium.fontWeight,
});

// GH-420: the drawer used to span the full screen height and covered the
// header, so the menu icon sat underneath the drawer's first entry: tapping it
// again to close the drawer selected "Dashboard" instead. The drawer now starts
// below the header, which stays under the dimmed overlay — a tap on the menu
// icon lands on the overlay and closes the drawer. 64 is the Android header
// height of @react-navigation/elements (plus the status bar inset), and because
// the drawer no longer reaches under the status bar its list drops the
// status-bar padding and keeps only the default 12 dp spacing.
const ANDROID_HEADER_HEIGHT = 64;
const DRAWER_LIST_SPACING = 12;

export const getAnalyseDrawerLayoutOptions = (topInset: number) => ({
  drawerStyle: {top: ANDROID_HEADER_HEIGHT + topInset},
  drawerContentContainerStyle: {paddingTop: DRAWER_LIST_SPACING},
});

const AnalyseRouter = () => {
  const Stack = createDrawerNavigator<RootStackParamList>();
  let theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      backBehavior="history"
      screenOptions={({navigation}) => ({
        headerTintColor: theme.colors.onSecondaryContainer,
        headerTitleStyle: getAnalyseHeaderTitleStyle(theme.fonts),
        ...getAnalyseDrawerLayoutOptions(insets.top),
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
          title: route.params?.exercise?.name ?? 'Analysis',
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
        name="BodyWeight"
        component={BodyWeightScreen}
        options={() => ({
          title: 'Body Weight',
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
          title: 'Video Analysis',
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
        })}
      />
      <Stack.Screen
        name="ChatHistory"
        component={ChatHistoryScreen}
        options={() => ({
          title: 'Chat History',
        })}
      />
    </Stack.Navigator>
  );
};

export default AnalyseRouter;
