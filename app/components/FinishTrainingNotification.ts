import notifee, {AlarmType, AndroidImportance, TimestampTrigger, TriggerType} from "@notifee/react-native";
import {useSettings} from "../redux/settings/useSettings";
import {useState} from "react";

function createChannel() {
    return notifee.createChannel({
        id: 'gainalytics_training_done',
        name: 'Gainalytics training done',
        importance: AndroidImportance.HIGH
    });
}

export const FinishTrainingNotification = () => {
    let notificationId: string;
    let channelId: string;
    let pauseTimerInSeconds = useSettings().localNotification?.finishTrainingTimerInSeconds;
    // Request permissions (required for iOS)
    notifee.requestPermission().then(() =>
        createChannel().then((id) => channelId = id));
    return [() => {
        notificationId && notifee.cancelNotification(notificationId);
        if (pauseTimerInSeconds) {
            const trigger: TimestampTrigger = {
                type: TriggerType.TIMESTAMP,
                timestamp: Date.now() + pauseTimerInSeconds * 1000,
                alarmManager: {type: AlarmType.SET_AND_ALLOW_WHILE_IDLE},
            };
            (channelId ? Promise.resolve(channelId) : createChannel()).then((id) =>
                notifee.createTriggerNotification({
                    id: 'training_done',
                    title: 'Training in progress!',
                    body: 'If you are not doing an extended pause, go finish your training!',
                    android: {
                        channelId: id,
                        smallIcon: '@mipmap/icon_notification', // optional, defaults to 'ic_launcher'.
                        // pressAction is needed if you want the notification to open the app when pressed
                        pressAction: {
                            id: 'default',
                        },
                    },
                }, trigger))
                .then((id) => {
                    if (id) notificationId = id;
                });
        }
    },
        () => {
            notificationId && notifee.cancelNotification(notificationId);
        }];
};

