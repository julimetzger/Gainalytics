import { useEffect, useRef, useCallback } from 'react';
import notifee, {
    AlarmType,
    AndroidImportance,
    TimestampTrigger,
    TriggerType,
} from '@notifee/react-native';
import { useSettings } from '../redux/settings/useSettings';

function createChannel() {
    return notifee.createChannel({
        id: 'gainalytics_pause_done',
        name: 'Gainalytics pause done',
        importance: AndroidImportance.HIGH,
    });
}

export const PauseDoneNotification = () => {
    const pauseTimerInSeconds =
        useSettings().localNotification?.pauseTimerInSeconds ?? 0;

    const channelIdRef = useRef<string>();
    const notificationIdRef = useRef<string>('pause_done'); // stable id

    // Run once, await setup to avoid races
    useEffect(() => {
        (async () => {
            await notifee.requestPermission(); // Android 13+ POST_NOTIFICATIONS / iOS
            channelIdRef.current = await createChannel();
        })();
    }, []);

    const schedule = useCallback(async () => {
        if (pauseTimerInSeconds <= 0) return;

        const channelId = channelIdRef.current ?? (await createChannel());
        channelIdRef.current = channelId;

        const batteryOptimizationEnabled = await notifee.isBatteryOptimizationEnabled();

        const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: Date.now() + pauseTimerInSeconds! * 1000, // <- single !
            // Use AlarmManager only when not battery-optimized; otherwise let WorkManager handle it
            ...(!batteryOptimizationEnabled && {
                alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
            }),
        };

        await notifee.createTriggerNotification(
            {
                id: notificationIdRef.current,
                title: 'Pause expired!',
                body: 'It is time to crush your next set!',
                android: {
                    channelId,
                    smallIcon: '@mipmap/icon_notification',
                    pressAction: { id: 'default' },
                },
            },
            trigger
        );
    }, [pauseTimerInSeconds]);

    const cancel = useCallback(async () => {
        await notifee.cancelNotification(notificationIdRef.current);
    }, []);

    return [schedule, cancel] as const;
};
