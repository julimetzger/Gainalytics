import notifee, {AndroidImportance, AuthorizationStatus} from '@notifee/react-native';

export const VIDEO_ANALYSIS_CHANNEL_ID = 'video_analysis_complete';
export const VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE = 'video_analysis_complete';

const ensureChannel = async () => {
  return notifee.createChannel({
    id: VIDEO_ANALYSIS_CHANNEL_ID,
    name: 'Video Analysis Complete',
    importance: AndroidImportance.HIGH,
  });
};

/**
 * Request POST_NOTIFICATIONS permission (Android 13+).
 * Must be called before posting any video analysis notification.
 * Returns true if permission is granted, false if denied.
 * The analysis flow must continue regardless of the result.
 */
export async function requestVideoAnalysisNotificationPermission(): Promise<boolean> {
  const result = await notifee.requestPermission();
  return (
    result.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    result.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

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
        id: 'default',
      },
    },
    data: {
      type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
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
    data: {
      type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
      analysisId: String(analysisId),
    },
  });
};

/**
 * Extract the analysisId from a notifee notification data payload.
 * Returns undefined if the notification is not a video analysis notification.
 */
export function extractAnalysisIdFromNotification(
  notification: {data?: Record<string, string>} | null | undefined,
): number | undefined {
  const data = notification?.data;
  if (!data || data.type !== VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE) {
    return undefined;
  }
  const id = parseInt(data.analysisId, 10);
  return Number.isNaN(id) ? undefined : id;
}

/**
 * Estimate analysis duration based on video duration and a learned rate.
 *
 * @param videoDurationMs Actual video duration in ms (from file metadata).
 *   Pass 0 or a negative value when unknown — returns 0 in that case.
 * @param rateSecondsPerVideoSecond Analysis-time seconds per video-second
 *   learned from previous runs. Defaults to 1.0 (1:1 fallback ratio).
 * @returns Estimated analysis time in ms.
 */
export function estimateAnalysisTimeMs(videoDurationMs: number, rateSecondsPerVideoSecond: number = 1.0): number {
  if (videoDurationMs <= 0) {
    return 0;
  }
  return Math.round(videoDurationMs * rateSecondsPerVideoSecond);
}
