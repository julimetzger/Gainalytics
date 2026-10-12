import React from 'react';
import SettingsTab from '../tabs/settings/SettingsTab';
import ChatGptPocScreen from '../tabs/settings/ChatGptPocScreen';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Settings: undefined;
  ChatGptPoc: undefined;
};

const SettingsRouter = () => {
  const Stack = createNativeStackNavigator<RootStackParamList>();
  return (
    <Stack.Navigator initialRouteName="Settings">
      <Stack.Screen
        name="Settings"
        component={SettingsTab}
        options={{
          title: 'Settings',
        }}
      />
      {__DEV__ ? (
        // GH-504 PoC: dev-only, opened via long-press on the Settings version footer.
        <Stack.Screen name="ChatGptPoc" component={ChatGptPocScreen} options={{title: 'ChatGPT PoC'}} />
      ) : null}
    </Stack.Navigator>
  );
};

export default SettingsRouter;
