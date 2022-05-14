import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import confiugureStore from './confiugureStore';
import {DefaultTheme as PaperTheme, Provider as PaperProvider} from 'react-native-paper';
import RootRouter from './app/routing/rootRouter';

const {store, persistor} = confiugureStore();

const PaperThemes = {
  ...PaperTheme,
  colors: {
    ...PaperTheme.colors,
    backgroundColor: 'black',
    primary: '#0891b2',
    accent: '#7e22ce',
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
