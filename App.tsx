import React from 'react';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import configureStore from './configureStore';
import {NavigationContainer, DarkTheme as NavigationDarkTheme} from '@react-navigation/native';
import {MD3DarkTheme as PaperDarkTheme, Provider as PaperProvider} from 'react-native-paper';
import merge from 'deepmerge';
import {BottomTabs} from './app/routing/bottomNavigator';
import {EventProvider} from "react-native-outside-press";

const CombinedDarkTheme = merge(PaperDarkTheme, NavigationDarkTheme);

const {store, persistor} = configureStore();

export const PaperThemes = {
    ...CombinedDarkTheme,
    colors: {
        ...CombinedDarkTheme.colors,
        primary: PaperDarkTheme.colors.primary,
        background: PaperDarkTheme.colors.background,
        text: PaperDarkTheme.colors.onSecondaryContainer,
        dark: true,
    },
};


const App: () => React.ReactElement = () => {
    return (
        <>
            <Provider store={store}>
                <PersistGate loading={null} persistor={persistor}>
                    <PaperProvider theme={PaperThemes}>
                        <EventProvider>
                            <NavigationContainer theme={PaperThemes}>
                                <BottomTabs/>
                            </NavigationContainer>
                        </EventProvider>
                    </PaperProvider>
                </PersistGate>
            </Provider>
        </>
    );
};

export default App;
