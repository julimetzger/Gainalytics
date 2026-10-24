import React from 'react';
import SettingsTab from '../tabs/settings/SettingsTab';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HealthConnectPocScreen from '../debug/healthConnectPoc/HealthConnectPocScreen';
import {isHealthConnectPocAvailable} from '../debug/healthConnectPoc/healthConnectPocNative';

export type RootStackParamList = {
  // GH-497: the onboarding's "Import data" opens the import confirmation.
  Settings: {openImport?: boolean} | undefined;
  HealthConnectPoc: undefined;
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
      {/* GH-502 PoC: only exists in debug builds that ship the native module. */}
      {isHealthConnectPocAvailable() && (
        <Stack.Screen name="HealthConnectPoc" component={HealthConnectPocScreen} options={{title: 'Health Connect PoC'}} />
      )}
    </Stack.Navigator>
  );
};

export default SettingsRouter;
