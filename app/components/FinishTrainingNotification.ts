import {useEffect, useRef, useCallback} from 'react';
import {Platform} from 'react-native';
import notifee, {
    AlarmType,
    AndroidImportance,
    TimestampTrigger,
    TriggerType,
} from '@notifee/react-native';
import {useSettings} from '../redux/settings/useSettings';
import {canScheduleExactAlarms} from "../utils/NotificationUtils";

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
            // Android 13+ runtime notif permission + iOS prompt
            await notifee.requestPermission();
            channelIdRef.current = await createChannel();
        })();
    }, []);

    const schedule = useCallback(async () => {
        if (pauseTimerInSeconds <= 0) return;

        const channelId = channelIdRef.current ?? (await createChannel());
        channelIdRef.current = channelId;

        // Prefer exact alarm if we can
        let useExact = false;
        if (Platform.OS === 'android') {
            if (Platform.Version >= 31) {
                useExact = await canScheduleExactAlarms();
                // Removed automatic openExactAlarmSettings - user should manage this in Settings
            } else {
                useExact = true; // < Android 12: exact alarms allowed without special permission
            }
        }

        const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            // small buffer helps avoid "now/past" rounding issues
            timestamp: Date.now() + pauseTimerInSeconds * 1000 + 250,
            ...(useExact && {alarmManager: {type: AlarmType.SET_AND_ALLOW_WHILE_IDLE}}),
        };

        console.log("exact ", useExact)
        await notifee.createTriggerNotification(
            {
                id: notificationIdRef.current,
                title: 'Training in progress!',
                body: 'If you are not doing an extended pause, go finish your training!',
                android: {
                    channelId,
                    smallIcon: '@mipmap/icon_notification',
                    pressAction: {id: 'default'},
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
