import {
  extractAnalysisIdFromInitialNotification,
  extractAnalysisIdFromNotificationPressEvent,
} from './videoAnalysisNotification';

interface VideoAnalysisNavigationRef {
  isReady: () => boolean;
  navigate: (screen: string, params: unknown) => void;
}

let pendingVideoAnalysisNavigation: number | undefined;

export const queueVideoAnalysisNavigation = (analysisId: number) => {
  pendingVideoAnalysisNavigation = analysisId;
};

export const navigateToVideoAnalysis = (navigationRef: VideoAnalysisNavigationRef, analysisId: number) => {
  if (navigationRef.isReady()) {
    pendingVideoAnalysisNavigation = undefined;
    navigationRef.navigate('Analyse', {
      screen: 'VideoAnalysisDetail',
      params: {analysisId},
    });
    return;
  }

  pendingVideoAnalysisNavigation = analysisId;
};

export const flushPendingVideoAnalysisNavigation = (navigationRef: VideoAnalysisNavigationRef) => {
  if (pendingVideoAnalysisNavigation === undefined || !navigationRef.isReady()) {
    return;
  }

  const pendingAnalysisId = pendingVideoAnalysisNavigation;
  pendingVideoAnalysisNavigation = undefined;
  navigationRef.navigate('Analyse', {
    screen: 'VideoAnalysisDetail',
    params: {analysisId: pendingAnalysisId},
  });
};

export const handleInitialVideoAnalysisNotification = (
  navigationRef: VideoAnalysisNavigationRef,
  initialNotification: {notification?: {data?: Record<string, string>}} | null | undefined,
) => {
  const analysisId = extractAnalysisIdFromInitialNotification(initialNotification);
  if (analysisId !== undefined) {
    navigateToVideoAnalysis(navigationRef, analysisId);
  }
};

export const handleVideoAnalysisNotificationPressEvent = (
  navigationRef: VideoAnalysisNavigationRef,
  type: number,
  detail: {notification?: {data?: Record<string, string>}} | null | undefined,
) => {
  const analysisId = extractAnalysisIdFromNotificationPressEvent(type, detail);
  if (analysisId !== undefined) {
    navigateToVideoAnalysis(navigationRef, analysisId);
  }
};

export const _resetPendingVideoAnalysisNavigationForTesting = () => {
  pendingVideoAnalysisNavigation = undefined;
};
