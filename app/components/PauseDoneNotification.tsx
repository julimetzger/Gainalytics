import notifee, {AlarmType, AndroidImportance, TimestampTrigger, TriggerType} from '@notifee/react-native';
import {useSettings} from '../redux/settings/useSettings';

export const PauseDoneNotification = () => {
  let notificationId: string;
  let channelId: string;
  let pauseTimerInSeconds = useSettings().localNotification?.pauseTimerInSeconds;
  // Request permissions (required for iOS)
  notifee.requestPermission().then(() =>
    notifee.createChannel({
      id: 'gainalytics_pause_done',
      name: 'Gainalytics pause done',
      importance: AndroidImportance.HIGH,
    }).then((id) => channelId = id));
  return [() => {
    console.log('called notification');
    notificationId && notifee.cancelNotification(notificationId);
    if (pauseTimerInSeconds) {
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + pauseTimerInSeconds * 1000,
        alarmManager: {type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE},
      };
      console.log('timestamp', trigger);
      notifee.createTriggerNotification({
        id: 'pause_done',
        title: 'Pause expired!',
        body: 'It is time to crush your next set!',
        android: {
          channelId,
          smallIcon: '@mipmap/icon_notification',
          pressAction: {
            id: 'default',
          },
        },
      }, trigger).then((id) => {
        if (id) notificationId = id;
      });
    }
  },
    () => {
      notificationId && notifee.cancelNotification(notificationId);
    }];
};
