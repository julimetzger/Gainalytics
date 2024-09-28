import React from 'react';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import configureStore from './configureStore';
import {DarkTheme as NavigationDarkTheme, NavigationContainer} from '@react-navigation/native';
import {
    DefaultTheme,
    MD3DarkTheme as PaperDarkTheme,
    MD3LightTheme,
    Provider as PaperProvider
} from 'react-native-paper';
import merge from 'deepmerge';
import {BottomTabs} from './app/routing/bottomNavigator';
import {EventProvider} from "react-native-outside-press";
import {registerTranslation} from 'react-native-paper-dates';
import {useSettings} from "./app/redux/settings/useSettings";
import Toast from "react-native-toast-message";
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from "react-native-safe-area-context";

registerTranslation('en-GB', {
    save: 'Save',
    selectSingle: 'Select date',
    selectMultiple: 'Select dates',
    selectRange: 'Select period',
    notAccordingToDateFormat: (inputFormat) => `Date format must be ${inputFormat}`,
    mustBeHigherThan: (date) => `Must be later then ${date}`,
    mustBeLowerThan: (date) => `Must be earlier then ${date}`,
    mustBeBetween: (startDate, endDate) => `Must be between ${startDate} - ${endDate}`,
    dateIsDisabled: 'Day is not allowed',
    previous: 'Previous',
    next: 'Next',
    typeInDate: 'Type in date',
    pickDateFromCalendar: 'Pick date from calendar',
    close: 'Close',
    hour: 'Hour',
    minute: 'Minute'
})

const {store, persistor} = configureStore();

export const CombinedDarkTheme = merge(PaperDarkTheme, NavigationDarkTheme);
export const DarkTheme = {
    ...CombinedDarkTheme,
    colors: {
        ...CombinedDarkTheme.colors,
        primary: PaperDarkTheme.colors.primary,
        background: PaperDarkTheme.colors.background,
        card: PaperDarkTheme.colors.background,
        border: PaperDarkTheme.colors.surface,
        text: PaperDarkTheme.colors.onSecondaryContainer,
        dark: true,
    },
};

export const LightTheme = merge(MD3LightTheme, DefaultTheme);
export const LightThemeCombined = {
    ...LightTheme,
    colors: {
        ...LightTheme.colors,
        primary: MD3LightTheme.colors.primary,
        background: MD3LightTheme.colors.background,
        card: MD3LightTheme.colors.background,
        border: PaperDarkTheme.colors.surface,
        text: MD3LightTheme.colors.onSecondaryContainer,
    },
};

const AppWithPersist = () => {
    let appSettings = useSettings();
    let paperThemes;
    if (appSettings?.mode === 'light') {
        paperThemes = LightThemeCombined;
    } else {
        paperThemes = DarkTheme;
    }
    return <PersistGate loading={null} persistor={persistor}>
        <PaperProvider theme={paperThemes}>
            <SafeAreaProvider>
                <EventProvider>
                    <StatusBar backgroundColor={paperThemes.colors.background}
                               barStyle={appSettings?.mode === 'light' ? "dark-content" : "light-content"}/>
                    <NavigationContainer theme={paperThemes}>
                        <BottomTabs/>
                    </NavigationContainer>
                </EventProvider>
            </SafeAreaProvider>
        </PaperProvider>
        <Toast/>
    </PersistGate>;
}

const App: () => React.ReactElement = () => {
    return (
        <>
            <Provider store={store}>
                <AppWithPersist/>
            </Provider>
        </>
    );
};

export default App;
