import notifee, {AndroidImportance} from "@notifee/react-native";
import {useSettings} from "../redux/settings/useSettings";
import {useState} from "react";


export const PauseDoneNotification = () => {
    const [notified, setNotified] = useState(false)
    let pauseTimerInSeconds = useSettings().localNotification?.pauseTimerInSeconds;


    return [(elapsedTimeInSeconds: number) => {
        if (!notified && pauseTimerInSeconds !== undefined ? elapsedTimeInSeconds > pauseTimerInSeconds : false) {
            setNotified(true);
            showNotificatoin();
        }

        async function showNotificatoin() {
            // Request permissions (required for iOS)
            await notifee.requestPermission()
            const channelId = await notifee.createChannel({
                id: 'gainalytics_pause_done',
                name: 'gainalytics pause done',
                importance: AndroidImportance.HIGH
            });

            await notifee.displayNotification({
                id: 'pause_done',
                title: 'Pause expired!',
                body: 'It is time to crush your next set!',
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
