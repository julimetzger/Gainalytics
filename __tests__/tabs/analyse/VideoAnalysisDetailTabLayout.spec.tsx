import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import VideoAnalysisDetailTab from '../../../app/tabs/Analyse/VideoAnalysisDetailTab';
import {BarTrackingResult, VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../../app/redux/VideoAnalysis/use/useVideoAnalysis';
import {readBarTrackingResultFromFile} from '../../../app/utils/videoAnalysisStorage';

// GH-681: the detail screen shows the set heading first, then the video; the
// details, "Secure video in app", "Compare" and the VL reference sit at the very bottom.

jest.mock('../../../app/redux/VideoAnalysis/use/useVideoAnalysis', () => ({useVideoAnalysis: jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/use/useAllVideoAnalyses', () => ({useAllVideoAnalyses: () => []}));
jest.mock('../../../app/redux/VideoAnalysis/use/useVideoAnalysisSetIdentity', () => ({
  useVideoAnalysisSetIdentity: () => 'Squat · Set 1 · 175 kg @ 2 RIR',
}));
jest.mock('../../../app/redux/VideoAnalysis/use/useVideoAnalysisExerciseId', () => ({useVideoAnalysisExerciseId: () => 2}));
jest.mock('../../../app/redux/Exercises/use/useExerciseVlReference', () => ({useExerciseVlReference: () => undefined}));
jest.mock('../../../app/redux/settings/use/useVideoAnalysisFps', () => ({useVideoAnalysisFps: () => 30}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus', () => ({dispatchSetVideoAnalysisStatus: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult', () => ({dispatchAttachVideoAnalysisResult: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath', () => ({
  dispatchSetVideoAnalysisManualSeedFramePath: () => jest.fn(),
}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel', () => ({dispatchSetVideoAnalysisMetersPerPixel: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisLocalVideoPath', () => ({dispatchSetVideoAnalysisLocalVideoPath: () => jest.fn()}));
jest.mock('../../../app/utils/videoAnalysisStorage', () => ({
  getVideoAnalysisPreviewPath: () => '/mock/preview.jpg',
  readBarTrackingResultFromFile: jest.fn(),
}));
jest.mock('../../../app/utils/videoAnalysisNative', () => ({
  analyzeSquatVideo: jest.fn(),
  copyVideoToAppStorage: jest.fn(),
  isVideoSourceAvailable: jest.fn().mockResolvedValue(true),
  migrateBarTrackingResultIfNeeded: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../app/components/video/VideoAnalysisPlaybackOverlayCard', () => {
  const {View} = require('react-native');
  return () => <View testID="mock-playback-overlay" />;
});
jest.mock('../../../app/components/video/VelocityLossBarChart', () => {
  const {View} = require('react-native');
  return () => <View testID="mock-velocity-chart" />;
});
jest.mock('../../../app/components/video/VlReferenceCard', () => {
  const {View} = require('react-native');
  return () => <View testID="vl-reference-card" />;
});
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({navigate: jest.fn()})}));
jest.mock('react-native-toast-message', () => ({show: jest.fn()}));

const mockedUseVideoAnalysis = jest.mocked(useVideoAnalysis);
const mockedReadResult = jest.mocked(readBarTrackingResultFromFile);

const createAnalysis = (overrides?: Partial<VideoAnalysis>): VideoAnalysis => ({
  id: 2,
  exerciseId: 2,
  sourceUri: 'content://media/video/17917',
  resultPath: '/mock/documents/result-2.json',
  createdAt: new Date('2026-11-01T19:19:39.000Z'),
  status: VideoAnalysisStatus.DONE,
  videoMeta: {durationMs: 5000, fps: 30, width: 1920, height: 1080},
  ...overrides,
});

const result = {
  repMetrics: [{repIndex: 0, repTimeMs: 1500, concentricTimeMs: 700, averageConcentricSpeedPxPerS: 250, lowestConcentricSpeedPxPerS: 120}],
  analysisMeta: {sourceFps: 30, analyzedFps: 30, frameCount: 90, averageConfidence: 0.9},
} satisfies Partial<BarTrackingResult>;

/** testIDs in the order they are rendered on the screen (top -> bottom). */
const renderedTestIdOrder = (): string[] => {
  const ids: string[] = [];
  const visit = (node: unknown) => {
    if (node == null || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const element = node as {props?: {testID?: string}; children?: unknown};
    if (element.props?.testID) {
      ids.push(element.props.testID);
    }
    visit(element.children);
  };
  visit(screen.toJSON());
  return ids;
};

const renderDetail = () =>
  render(<VideoAnalysisDetailTab route={{key: 'detail', name: 'VideoAnalysisDetail', params: {analysisId: 2}} as any} navigation={{} as any} />);

describe('VideoAnalysisDetailTab layout (GH-681)', () => {
  beforeEach(() => {
    mockedReadResult.mockResolvedValue(result as BarTrackingResult);
  });

  it('renders heading, then the video, and the details/actions and VL reference at the very bottom', async () => {
    mockedUseVideoAnalysis.mockReturnValue(createAnalysis());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('mock-playback-overlay')).toBeTruthy());

    const order = renderedTestIdOrder().filter((id) =>
      [
        'video-analysis-detail-header',
        'mock-playback-overlay',
        'mock-velocity-chart',
        'video-analysis-details-card',
        'video-analysis-detail-status',
        'video-analysis-detail-analyzed-fps',
        'video-analysis-secure-video-button',
        'video-analysis-compare-button',
        'vl-reference-card',
      ].includes(id),
    );
    expect(order).toEqual([
      'video-analysis-detail-header',
      'mock-playback-overlay',
      'mock-velocity-chart',
      'video-analysis-details-card',
      'video-analysis-detail-status',
      'video-analysis-detail-analyzed-fps',
      'video-analysis-secure-video-button',
      'video-analysis-compare-button',
      'vl-reference-card',
    ]);
  });

  it('keeps only the set heading and date in the header card', async () => {
    mockedUseVideoAnalysis.mockReturnValue(createAnalysis());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('mock-playback-overlay')).toBeTruthy());

    const header = screen.getByTestId('video-analysis-detail-header');
    const headerTexts = screen
      .getAllByText(/.+/)
      .filter((node) => {
        let parent = node.parent;
        while (parent) {
          if (parent === header) {
            return true;
          }
          parent = parent.parent;
        }
        return false;
      })
      .map((node) => node.props.children);
    expect(headerTexts).toEqual(['Squat · Set 1 · 175 kg @ 2 RIR', new Date('2026-11-01T19:19:39.000Z').toLocaleString()]);
    expect(screen.getByTestId('video-analysis-detail-status')).toHaveTextContent('Status: done');
    expect(screen.getByTestId('video-analysis-detail-analyzed-fps')).toHaveTextContent('Analysed at 30 fps');
    expect(screen.getByTestId('video-analysis-secure-video-button')).toHaveTextContent('Secure video in app');
  });

  it('still opens the compare picker from the bottom Compare button', async () => {
    mockedUseVideoAnalysis.mockReturnValue(createAnalysis());
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('mock-playback-overlay')).toBeTruthy());

    fireEvent.press(screen.getByTestId('video-analysis-compare-button'));

    expect(screen.getByText('Select analysis to compare')).toBeTruthy();
    expect(screen.getByText('No other completed analyses available.')).toBeTruthy();
  });

  it('shows no Compare button and no VL reference while the analysis is still processing', async () => {
    mockedUseVideoAnalysis.mockReturnValue(createAnalysis({status: VideoAnalysisStatus.PROCESSING, resultPath: undefined}));
    renderDetail();
    await waitFor(() => expect(screen.getByText('No analysis result available yet.')).toBeTruthy());

    expect(screen.getByTestId('video-analysis-detail-status')).toHaveTextContent('Status: processing');
    expect(screen.queryByTestId('video-analysis-compare-button')).toBeNull();
    expect(screen.queryByTestId('vl-reference-card')).toBeNull();
  });
});
