import notifee, {AlarmType, AndroidImportance, TimestampTrigger, TriggerType} from '@notifee/react-native';
import {useSettings} from '../redux/settings/useSettings';

function createChannel() {
    return notifee.createChannel({
        id: 'gainalytics_pause_done',
        name: 'Gainalytics pause done',
        importance: AndroidImportance.HIGH,
    });
}

export const PauseDoneNotification = () => {
    let notificationId: string;
    let channelId: string;
    let pauseTimerInSeconds = useSettings().localNotification?.pauseTimerInSeconds;
    // Request permissions (required for iOS)
    notifee.requestPermission().then(() =>
        createChannel().then((id) => channelId = id));
    return [() => {
        notificationId && notifee.cancelNotification(notificationId);
        if (pauseTimerInSeconds) {
            const trigger: TimestampTrigger = {
                type: TriggerType.TIMESTAMP,
                timestamp: Date.now() + pauseTimerInSeconds * 1000,
                alarmManager: {type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE},
            };
            (channelId ? Promise.resolve(channelId) : createChannel()).then((id) =>
                notifee.createTriggerNotification({
                    id: 'pause_done',
                    title: 'Pause expired!',
                    body: 'It is time to crush your next set!',
                    android: {
                       channelId: id,
                        smallIcon: '@mipmap/icon_notification',
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
