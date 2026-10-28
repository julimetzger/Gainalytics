import React from 'react';
import SettingsTab from '../tabs/settings/SettingsTab';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

export type RootStackParamList = {
  // GH-497: the onboarding's "Import data" opens the import confirmation.
  // GH-645: the Coach Insight notice opens the AI Configuration.
  Settings: {openImport?: boolean; openAiConfig?: boolean} | undefined;
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
    </Stack.Navigator>
  );
};

export default SettingsRouter;
