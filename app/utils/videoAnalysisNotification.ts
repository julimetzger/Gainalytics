import notifee, {AndroidImportance, AuthorizationStatus, EventType} from '@notifee/react-native';

export const VIDEO_ANALYSIS_CHANNEL_ID = 'gainalytics_video_analysis';
export const VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE = 'video_analysis_complete';

async function createVideoAnalysisChannel(): Promise<string> {
  return notifee.createChannel({
    id: VIDEO_ANALYSIS_CHANNEL_ID,
    name: 'Video Analysis',
    importance: AndroidImportance.HIGH,
  });
}

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

export async function postVideoAnalysisCompleteNotification(analysisId: number): Promise<void> {
  const channelId = await createVideoAnalysisChannel();
  await notifee.displayNotification({
    title: 'Video analysis complete',
    body: 'Tap to view the results.',
    data: {
      type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
      analysisId: String(analysisId),
    },
    android: {
      channelId,
      smallIcon: '@mipmap/icon_notification',
      pressAction: {id: 'default'},
    },
  });
}

export async function postVideoAnalysisFailedNotification(analysisId: number): Promise<void> {
  const channelId = await createVideoAnalysisChannel();
  await notifee.displayNotification({
    title: 'Video analysis failed',
    body: 'The video could not be analyzed. Tap to view details.',
    data: {
      type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
      analysisId: String(analysisId),
    },
    android: {
      channelId,
      smallIcon: '@mipmap/icon_notification',
      pressAction: {id: 'default'},
    },
  });
}

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

export {EventType};
