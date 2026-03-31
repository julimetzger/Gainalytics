import {
  VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
  estimateAnalysisTimeMs,
  extractAnalysisIdFromInitialNotification,
  extractAnalysisIdFromNotification,
  extractAnalysisIdFromNotificationPressEvent,
  postVideoAnalysisCompleteNotification,
  postVideoAnalysisFailedNotification,
  requestVideoAnalysisNotificationPermission,
  _resetVideoAnalysisNotificationPermissionCacheForTesting,
} from '../videoAnalysisNotification';

// ---------------------------------------------------------------------------
// notifee mock
// ---------------------------------------------------------------------------
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(),
    createChannel: jest.fn().mockResolvedValue('gainalytics_video_analysis'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    onBackgroundEvent: jest.fn(),
    onForegroundEvent: jest.fn(() => () => {}),
    getInitialNotification: jest.fn().mockResolvedValue(null),
  },
  AuthorizationStatus: {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    DENIED: 0,
    NOT_DETERMINED: -1,
  },
  AndroidImportance: {HIGH: 4},
  EventType: {PRESS: 1, DISMISSED: 0},
}));

// Grab the mock via requireMock AFTER mock is registered (no hoisting issue).
const {default: notifeeMock} = jest.requireMock('@notifee/react-native') as {
  default: {
    requestPermission: jest.Mock;
    createChannel: jest.Mock;
    displayNotification: jest.Mock;
  };
};
const mockRequestPermission = notifeeMock.requestPermission;
const mockCreateChannel = notifeeMock.createChannel;
const mockDisplayNotification = notifeeMock.displayNotification;

// ---------------------------------------------------------------------------
// requestVideoAnalysisNotificationPermission
// ---------------------------------------------------------------------------
describe('requestVideoAnalysisNotificationPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetVideoAnalysisNotificationPermissionCacheForTesting();
  });

  it('returns true when permission is AUTHORIZED', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 1});
    const result = await requestVideoAnalysisNotificationPermission();
    expect(result).toBe(true);
  });

  it('returns true when permission is PROVISIONAL', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 2});
    const result = await requestVideoAnalysisNotificationPermission();
    expect(result).toBe(true);
  });

  it('returns false when permission is DENIED', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 0});
    const result = await requestVideoAnalysisNotificationPermission();
    expect(result).toBe(false);
  });

  it('calls notifee.requestPermission exactly once', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 1});
    await requestVideoAnalysisNotificationPermission();
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// posting notifications
// ---------------------------------------------------------------------------
describe('postVideoAnalysisCompleteNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetVideoAnalysisNotificationPermissionCacheForTesting();
  });

  it('requests permission before posting the completion notification', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 1});

    await postVideoAnalysisCompleteNotification(42);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockCreateChannel).toHaveBeenCalledTimes(1);
    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
          analysisId: '42',
        },
      }),
    );
  });

  it('does not post the completion notification when permission is denied', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 0});

    await postVideoAnalysisCompleteNotification(42);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockCreateChannel).not.toHaveBeenCalled();
    expect(mockDisplayNotification).not.toHaveBeenCalled();
  });
});

describe('postVideoAnalysisFailedNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetVideoAnalysisNotificationPermissionCacheForTesting();
  });

  it('requests permission before posting the failure notification', async () => {
    mockRequestPermission.mockResolvedValue({authorizationStatus: 1});

    await postVideoAnalysisFailedNotification(7);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockDisplayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
          analysisId: '7',
        },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// extractAnalysisIdFromNotification
// ---------------------------------------------------------------------------
describe('extractAnalysisIdFromNotification', () => {
  it('extracts analysisId from a valid video_analysis_complete notification', () => {
    const notification = {
      data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: '42'},
    };
    expect(extractAnalysisIdFromNotification(notification)).toBe(42);
  });

  it('returns undefined for a notification with a different data type', () => {
    const notification = {
      data: {type: 'other_type', analysisId: '42'},
    };
    expect(extractAnalysisIdFromNotification(notification)).toBeUndefined();
  });

  it('returns undefined when notification is null', () => {
    expect(extractAnalysisIdFromNotification(null)).toBeUndefined();
  });

  it('returns undefined when notification is undefined', () => {
    expect(extractAnalysisIdFromNotification(undefined)).toBeUndefined();
  });

  it('returns undefined when data is missing', () => {
    expect(extractAnalysisIdFromNotification({})).toBeUndefined();
  });

  it('returns undefined when analysisId is not a valid number', () => {
    const notification = {
      data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: 'abc'},
    };
    expect(extractAnalysisIdFromNotification(notification)).toBeUndefined();
  });

  it('handles analysisId = 0 correctly', () => {
    const notification = {
      data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: '0'},
    };
    // parseInt('0') = 0, which is not NaN, so it should return 0
    expect(extractAnalysisIdFromNotification(notification)).toBe(0);
  });
});

describe('extractAnalysisIdFromNotificationPressEvent', () => {
  it('returns the analysisId for press events with matching notification data', () => {
    expect(
      extractAnalysisIdFromNotificationPressEvent(1, {
        notification: {
          data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: '8'},
        },
      }),
    ).toBe(8);
  });

  it('returns undefined for non-press events', () => {
    expect(
      extractAnalysisIdFromNotificationPressEvent(0, {
        notification: {
          data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: '8'},
        },
      }),
    ).toBeUndefined();
  });
});

describe('extractAnalysisIdFromInitialNotification', () => {
  it('extracts the analysisId from an initial notifee notification payload', () => {
    expect(
      extractAnalysisIdFromInitialNotification({
        notification: {
          data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: '13'},
        },
      }),
    ).toBe(13);
  });

  it('returns undefined when the initial notification is missing', () => {
    expect(extractAnalysisIdFromInitialNotification(null)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// estimateAnalysisTimeMs — duration-based progress calculation
// ---------------------------------------------------------------------------
describe('estimateAnalysisTimeMs', () => {
  it('returns 0 when videoDurationMs is 0 (unknown duration)', () => {
    expect(estimateAnalysisTimeMs(0)).toBe(0);
  });

  it('returns 0 when videoDurationMs is negative', () => {
    expect(estimateAnalysisTimeMs(-1000)).toBe(0);
  });

  it('uses 1:1 ratio as default when no rate is provided', () => {
    // 6000ms video, default 1.0 rate → 6000ms estimated
    expect(estimateAnalysisTimeMs(6000)).toBe(6000);
  });

  it('applies a custom rate (faster than real-time)', () => {
    // 10s video, 0.5 analysis-seconds per video-second → 5000ms
    expect(estimateAnalysisTimeMs(10_000, 0.5)).toBe(5000);
  });

  it('applies a custom rate (slower than real-time)', () => {
    // 10s video, 3.0 analysis-seconds per video-second → 30000ms
    expect(estimateAnalysisTimeMs(10_000, 3.0)).toBe(30_000);
  });

  it('rounds fractional results to whole milliseconds', () => {
    // 1000ms video, rate 1.5 → 1500ms (already whole)
    expect(estimateAnalysisTimeMs(1000, 1.5)).toBe(1500);
    // 1000ms video, rate 1.3333 → 1333ms
    expect(estimateAnalysisTimeMs(1000, 1.3333)).toBe(1333);
  });
});
