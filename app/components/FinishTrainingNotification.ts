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
        id: 'gainalytics_training_done',
        name: 'Gainalytics training done',
        importance: AndroidImportance.HIGH,
    });
}

export const FinishTrainingNotification = () => {
    const pauseTimerInSeconds =
        useSettings().localNotification?.finishTrainingTimerInSeconds ?? 0;

    const channelIdRef = useRef<string>();
    const notificationIdRef = useRef<string>('training_done'); // stable id

    useEffect(() => {
        (async () => {
            await notifee.requestPermission();     // Android 13+ / iOS
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
            timestamp: Date.now() + pauseTimerInSeconds! * 1000, // non-null assertion once
            // Use AlarmManager only if battery optimization is OFF; else let WorkManager handle it
            ...(!batteryOptimizationEnabled && {
                alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
            }),
        };

        await notifee.createTriggerNotification(
            {
                id: notificationIdRef.current,
                title: 'Training in progress!',
                body: 'If you are not doing an extended pause, go finish your training!',
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
