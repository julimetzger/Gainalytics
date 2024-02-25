import React, {useEffect, useState} from 'react';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import confiugureStore from './confiugureStore';
import {NavigationContainer, DarkTheme as NavigationDarkTheme} from '@react-navigation/native';
import {MD3DarkTheme, MD3DarkTheme as PaperDarkTheme, Provider as PaperProvider} from 'react-native-paper';
import merge from 'deepmerge';
import {BottomTabs} from './app/routing/bottomNavigator';
import {hasMigratedFromAsyncStorage, migrateFromAsyncStorage} from "./storage";
import {ActivityIndicator, InteractionManager, View} from "react-native";
import {EventProvider} from "react-native-outside-press";

const CombinedDarkTheme = merge(PaperDarkTheme, NavigationDarkTheme);

const {store, persistor} = confiugureStore();

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
    const [hasMigrated, setHasMigrated] = useState(hasMigratedFromAsyncStorage);


    useEffect(() => {
        if (!hasMigratedFromAsyncStorage) {
            InteractionManager.runAfterInteractions(async () => {
                try {
                    await migrateFromAsyncStorage()
                    setHasMigrated(true)
                } catch (e) {
                    throw e;
                    // TODO: fall back to AsyncStorage? Wipe storage clean and use MMKV? Crash app?
                }
            });
        }
    }, []);
    if (!hasMigrated) {
        // show loading indicator while app is migrating storage...
        return (
            <View style={{justifyContent: 'center', alignItems: 'center'}}>
                <ActivityIndicator color="black"/>
            </View>
        );
    }

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
