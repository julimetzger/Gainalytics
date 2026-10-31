import React, {useEffect} from 'react';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import configureStore from './configureStore';
import {createNavigationContainerRef, NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import {BottomTabs} from './app/routing/bottomNavigator';
import OnboardingGate from './app/components/onboarding/OnboardingGate';
import HealthConnectLifecycle from './app/components/healthConnect/HealthConnectLifecycle';
import {toastConfig} from './app/components/common/toastConfig';
import {EventProvider} from 'react-native-outside-press';
import {registerTranslation} from 'react-native-paper-dates';
import {useSettings} from './app/redux/settings/use/useSettings';
import {useThemeMode} from './app/redux/settings/use/useThemeMode';
import {buildThemes} from './app/theme/buildThemes';
import Toast from 'react-native-toast-message';
import {AppState, LogBox, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import notifee from '@notifee/react-native';
import {
  extractAnalysisIdFromNotificationPressEvent,
} from './app/utils/videoAnalysisNotification';
import {
  flushPendingVideoAnalysisNavigation,
  handleInitialVideoAnalysisNotification,
  handleVideoAnalysisNotificationPressEvent,
  queueVideoAnalysisNavigation,
} from './app/utils/videoAnalysisNotificationNavigation';

export const navigationRef = createNavigationContainerRef<any>();

// Background event handler: runs when the app is in the background and the
// user taps a video_analysis_complete notification. Must be registered at
// module scope (outside React tree) before any component is mounted.
notifee.onBackgroundEvent(async ({type, detail}) => {
  const analysisId = extractAnalysisIdFromNotificationPressEvent(type, detail as any);
  if (analysisId !== undefined) {
    queueVideoAnalysisNavigation(analysisId);
  }
});

registerTranslation('en-GB', {
  save: 'Save',
  selectSingle: 'Select Date',
  selectMultiple: 'Select Dates',
  selectRange: 'Select Period',
  notAccordingToDateFormat: (inputFormat) => `Date format must be ${inputFormat}`,
  mustBeHigherThan: (date) => `Must be later then ${date}`,
  mustBeLowerThan: (date) => `Must be earlier then ${date}`,
  mustBeBetween: (startDate, endDate) => `Must be between ${startDate} - ${endDate}`,
  dateIsDisabled: 'Day is not allowed',
  previous: 'Previous',
  next: 'Next',
  typeInDate: 'Type in Date',
  pickDateFromCalendar: 'Pick Date from Calendar',
  close: 'Close',
  hour: 'Hour',
  minute: 'Minute',
});

LogBox.ignoreLogs([
  '[Reanimated] Reduced motion setting is enabled on this device.',
]);

const {store, persistor} = configureStore();


const AppWithPersist = () => {
  let appSettings = useSettings();
  const {scheme} = useThemeMode();
  const {DarkTheme, LightThemeCombined} = buildThemes(appSettings?.palette);
  let paperThemes = scheme === 'light' ? LightThemeCombined : DarkTheme;

  // Register foreground event handler for notification taps while the app is active.
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        flushPendingVideoAnalysisNavigation(navigationRef);
      }
    });

    const unsubscribe = notifee.onForegroundEvent(({type, detail}) => {
      handleVideoAnalysisNotificationPressEvent(navigationRef, type, detail as any);
    });

    flushPendingVideoAnalysisNavigation(navigationRef);

    return () => {
      appStateSubscription.remove();
      unsubscribe();
    };
  }, []);

  const handleNavigationReady = async () => {
    flushPendingVideoAnalysisNavigation(navigationRef);

    // Cold-start path: check if the app was launched by tapping a notification
    // while it was terminated.
    const initialEvent = await notifee.getInitialNotification();
    handleInitialVideoAnalysisNotification(navigationRef, initialEvent as any);
  };

  return (
    <PersistGate loading={null} persistor={persistor} onBeforeLift={() => { store.dispatch({type: 'RECOVER_STALE_VIDEO_ANALYSES'}); store.dispatch({type: 'REPAIR_DANGLING_EXERCISE_REFERENCES'}); }}>
      <GestureHandlerRootView style={{flex: 1}}>
        <PaperProvider theme={paperThemes}>
          <SafeAreaProvider>
            <EventProvider>
              <StatusBar backgroundColor={paperThemes.colors.background} barStyle={scheme === 'light' ? 'dark-content' : 'light-content'} />
              <NavigationContainer
                ref={navigationRef}
                theme={paperThemes}
                onReady={handleNavigationReady}
                onStateChange={(state) => {
                  // Navigation state tracking for analytics
                }}
              >
                <BottomTabs />
              </NavigationContainer>
              <HealthConnectLifecycle />
              {/* GH-497: covers the tabs on a first start without data. */}
              <OnboardingGate navigationRef={navigationRef} />
            </EventProvider>
          </SafeAreaProvider>
        </PaperProvider>
        <Toast config={toastConfig} />
      </GestureHandlerRootView>
    </PersistGate>
  );
};

const App: () => React.ReactElement = () => {
  return (
    <>
      <Provider store={store}>
        <AppWithPersist />
      </Provider>
    </>
  );
};

export default App;
