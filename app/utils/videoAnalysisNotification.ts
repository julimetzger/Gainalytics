import notifee, {AndroidImportance} from '@notifee/react-native';

const CHANNEL_ID = 'video_analysis_complete';

const ensureChannel = async () => {
  return notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Video Analysis Complete',
    importance: AndroidImportance.HIGH,
  });
};

export const showAnalysisCompleteNotification = async (analysisId: number) => {
  const channelId = await ensureChannel();

  await notifee.displayNotification({
    id: `video_analysis_done_${analysisId}`,
    title: 'Video Analysis Complete',
    body: `Analysis #${analysisId} is ready to view.`,
    android: {
      channelId,
      smallIcon: '@mipmap/icon_notification',
      pressAction: {
        id: 'open_analysis',
        launchActivity: 'default',
      },
    },
    data: {
      type: 'video_analysis_complete',
      analysisId: String(analysisId),
    },
  });
};

export const showAnalysisFailedNotification = async (analysisId: number) => {
  const channelId = await ensureChannel();

  await notifee.displayNotification({
    id: `video_analysis_failed_${analysisId}`,
    title: 'Video Analysis Failed',
    body: `Analysis #${analysisId} encountered an error.`,
    android: {
      channelId,
      smallIcon: '@mipmap/icon_notification',
      pressAction: {
        id: 'default',
      },
    },
  });
};
