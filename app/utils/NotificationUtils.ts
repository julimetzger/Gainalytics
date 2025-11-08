import {NativeModules} from 'react-native';
const {ExactAlarm} = NativeModules;

export const canScheduleExactAlarms = (): Promise<boolean> => ExactAlarm?.canScheduleExactAlarms?.() ?? Promise.resolve(false);

export const openExactAlarmSettings = (): Promise<void> => ExactAlarm?.openExactAlarmSettings?.() ?? Promise.resolve();
