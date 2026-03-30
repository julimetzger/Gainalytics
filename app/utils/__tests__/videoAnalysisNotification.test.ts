import {AuthorizationStatus} from '@notifee/react-native';
import {
  extractAnalysisIdFromNotification,
  requestVideoAnalysisNotificationPermission,
  VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
} from '../videoAnalysisNotification';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(),
    createChannel: jest.fn().mockResolvedValue('video_analysis_complete'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
  },
  AndroidImportance: {HIGH: 4},
  AuthorizationStatus: {AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0, NOT_DETERMINED: -1},
}));

const notifee = jest.requireMock('@notifee/react-native').default as {
  requestPermission: jest.Mock;
};

describe('extractAnalysisIdFromNotification', () => {
  it('returns the analysisId from a valid video_analysis_complete notification', () => {
    const notification = {
      data: {
        type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE,
        analysisId: '42',
      },
    };
    expect(extractAnalysisIdFromNotification(notification)).toBe(42);
  });

  it('returns undefined for null notification (no initial notification on cold start)', () => {
    expect(extractAnalysisIdFromNotification(null)).toBeUndefined();
  });

  it('returns undefined for undefined notification', () => {
    expect(extractAnalysisIdFromNotification(undefined)).toBeUndefined();
  });

  it('returns undefined when notification data type does not match', () => {
    const notification = {
      data: {type: 'other_type', analysisId: '7'},
    };
    expect(extractAnalysisIdFromNotification(notification)).toBeUndefined();
  });

  it('returns undefined when analysisId is not a valid number', () => {
    const notification = {
      data: {type: VIDEO_ANALYSIS_NOTIFICATION_DATA_TYPE, analysisId: 'not-a-number'},
    };
    expect(extractAnalysisIdFromNotification(notification)).toBeUndefined();
  });

  it('returns undefined when data is missing', () => {
    expect(extractAnalysisIdFromNotification({})).toBeUndefined();
  });
});

describe('requestVideoAnalysisNotificationPermission', () => {
  it('returns true when permission is AUTHORIZED', async () => {
    notifee.requestPermission.mockResolvedValue({
      authorizationStatus: AuthorizationStatus.AUTHORIZED,
    });
    const result = await requestVideoAnalysisNotificationPermission();
    expect(result).toBe(true);
  });

  it('returns true when permission is PROVISIONAL', async () => {
    notifee.requestPermission.mockResolvedValue({
      authorizationStatus: AuthorizationStatus.PROVISIONAL,
    });
    const result = await requestVideoAnalysisNotificationPermission();
    expect(result).toBe(true);
  });

  it('returns false when permission is DENIED', async () => {
    notifee.requestPermission.mockResolvedValue({
      authorizationStatus: AuthorizationStatus.DENIED,
    });
    const result = await requestVideoAnalysisNotificationPermission();
    expect(result).toBe(false);
  });
});
