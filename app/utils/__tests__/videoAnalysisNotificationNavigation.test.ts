jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(),
    createChannel: jest.fn(),
    displayNotification: jest.fn(),
  },
  AuthorizationStatus: {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
  AndroidImportance: {
    HIGH: 4,
  },
  EventType: {
    PRESS: 1,
  },
}));

import {
  _resetPendingVideoAnalysisNavigationForTesting,
  flushPendingVideoAnalysisNavigation,
  handleInitialVideoAnalysisNotification,
  queueVideoAnalysisNavigation,
} from '../videoAnalysisNotificationNavigation';

const createNavigationRef = (isReady: boolean = true) => ({
  isReady: jest.fn(() => isReady),
  navigate: jest.fn(),
});

describe('videoAnalysisNotificationNavigation', () => {
  beforeEach(() => {
    _resetPendingVideoAnalysisNavigationForTesting();
    jest.clearAllMocks();
  });

  it('navigates to VideoAnalysisDetail from the initial notification payload', () => {
    const navigationRef = createNavigationRef();

    handleInitialVideoAnalysisNotification(navigationRef, {
      notification: {
        data: {
          type: 'video_analysis_complete',
          analysisId: '13',
        },
      },
    });

    expect(navigationRef.navigate).toHaveBeenCalledWith('Analyse', {
      screen: 'VideoAnalysisDetail',
      params: {analysisId: 13},
    });
  });

  it('queues a background notification tap until navigation is ready', () => {
    queueVideoAnalysisNavigation(21);

    const notReadyNavigationRef = createNavigationRef(false);
    flushPendingVideoAnalysisNavigation(notReadyNavigationRef);
    expect(notReadyNavigationRef.navigate).not.toHaveBeenCalled();

    const readyNavigationRef = createNavigationRef(true);
    flushPendingVideoAnalysisNavigation(readyNavigationRef);

    expect(readyNavigationRef.navigate).toHaveBeenCalledWith('Analyse', {
      screen: 'VideoAnalysisDetail',
      params: {analysisId: 21},
    });
  });
});
