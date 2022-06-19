import React from 'react';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import confiugureStore from './confiugureStore';
import {NavigationContainer, DarkTheme as NavigationDarkTheme} from '@react-navigation/native';
import {DarkTheme as PaperDarkTheme, Provider as PaperProvider} from 'react-native-paper';
import merge from 'deepmerge';
import {BottomTabs} from './app/routing/bottomNavigator';

const CombinedDarkTheme = merge(PaperDarkTheme, NavigationDarkTheme);

const {store, persistor} = confiugureStore();

export const PaperThemes = {
  ...CombinedDarkTheme,
  colors: {
    ...CombinedDarkTheme.colors,
    dark: true,
  },
};

const App: () => React.ReactElement = () => {
  return (
    <>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <PaperProvider theme={PaperThemes}>
            <NavigationContainer theme={PaperThemes}>
              <BottomTabs />
            </NavigationContainer>
          </PaperProvider>
        </PersistGate>
      </Provider>
    </>
  );
};

export default App;
