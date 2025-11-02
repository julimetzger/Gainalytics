
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import notifee, {
    AlarmType,
    AndroidImportance,
    TimestampTrigger,
    TriggerType,
} from '@notifee/react-native';
import { useSettings } from '../redux/settings/useSettings';
import {canScheduleExactAlarms} from "../utils/NotificationUtils";

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

        // ---- Always prefer AlarmManager exact trigger ----
        let useExact = false;
        if (Platform.OS === 'android') {
            if (Platform.Version >= 31) {
                useExact = await canScheduleExactAlarms();
                // Removed automatic openExactAlarmSettings - user should manage this in Settings
            } else {
                useExact = true; // < Android 12
            }
        }

        const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: Date.now() + pauseTimerInSeconds * 1000 + 250, // kleine Pufferzeit
            ...(useExact && { alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE } }),
        };

        await notifee.createTriggerNotification(
            {
                id: notificationIdRef.current,
                title: 'Pause beendet!',
                body: 'Zeit, das nächste Set zu starten!',
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
