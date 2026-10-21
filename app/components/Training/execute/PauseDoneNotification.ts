import {useEffect, useRef, useCallback} from 'react';
import {Platform} from 'react-native';
import notifee, {AlarmType, AndroidImportance, TimestampTrigger, TriggerType} from '@notifee/react-native';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {canScheduleExactAlarms} from '../../../utils/NotificationUtils';

function createChannel() {
  return notifee.createChannel({
    id: 'gainalytics_pause_done',
    name: 'Gainalytics rest done',
    importance: AndroidImportance.HIGH,
  });
}

export const PauseDoneNotification = () => {
  let appSettings = useSettings();
  const useExact = appSettings.localNotification?.exactAlarmPermission ?? false;
  const channelIdRef = useRef<string>();
  const notificationIdRef = useRef<string>('pause_done'); // stable id

  useEffect(() => {
    (async () => {
      await notifee.requestPermission(); // Android 13+ POST_NOTIFICATIONS / iOS
      channelIdRef.current = await createChannel();
    })();
  }, []);

  const schedule = useCallback(async (seconds: number) => {
    if (seconds <= 0) return;

    const channelId = channelIdRef.current ?? (await createChannel());
    channelIdRef.current = channelId;

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000 + 250, // small buffer time
      ...(useExact && {alarmManager: {type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE}}),
    };

    await notifee.createTriggerNotification(
      {
        id: notificationIdRef.current,
        title: 'Rest done!',
        body: 'Time to start the next set!',
        android: {
          channelId,
          smallIcon: '@mipmap/icon_notification',
          pressAction: {id: 'default'},
        },
      },
      trigger,
    );
  }, [useExact]);

  const cancel = useCallback(async () => {
    await notifee.cancelNotification(notificationIdRef.current);
  }, []);

  return [schedule, cancel] as const;
};
