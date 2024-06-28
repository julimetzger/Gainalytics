import notifee, {AndroidImportance} from "@notifee/react-native";
import {useSettings} from "../redux/settings/useSettings";
import {useState} from "react";


export const FinishTrainingNotification = () => {
    const [notified, setNotified] = useState(false)
    let pauseTimerInSeconds = useSettings().localNotification?.finishTrainingTimerInSeconds;


    return [(elapsedTimeInSeconds: number) => {
        if (!notified && pauseTimerInSeconds !== undefined ? elapsedTimeInSeconds > pauseTimerInSeconds : false) {
            setNotified(true);
            showNotificatoin();
        }

        async function showNotificatoin() {
            // Request permissions (required for iOS)
            await notifee.requestPermission()
            const channelId = await notifee.createChannel({
                id: 'gainalytics_training_done',
                name: 'gainalytics training done'
            });

            await notifee.displayNotification({
                id: 'training_done',
                title: 'Training in progress!',
                body: 'If you are not doing an extended pause, go finish your training!',
                android: {
                    channelId,
                    smallIcon: '@mipmap/ic_launcher', // optional, defaults to 'ic_launcher'.
                    // pressAction is needed if you want the notification to open the app when pressed
                    pressAction: {
                        id: 'default',
                    },
                },
            });
        }

    }, () => {
        setNotified(false)
    }] as [(elapsedTimeInSeconds: number) => void, () => void]
}
