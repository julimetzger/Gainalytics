import React from 'react';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import confiugureStore from './confiugureStore';
import RootRouter from './app/routing/rootRouter';
import {NavigationContainer, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme} from '@react-navigation/native';
import {DarkTheme as PaperDarkTheme, DefaultTheme as PaperDefaultTheme, Provider as PaperProvider} from 'react-native-paper';
import merge from 'deepmerge';

const CombinedDefaultTheme = merge(PaperDefaultTheme, NavigationDefaultTheme);
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
            <NavigationContainer>
              <RootRouter />
            </NavigationContainer>
          </PaperProvider>
        </PersistGate>
      </Provider>
    </>
  );
};

export default App;
