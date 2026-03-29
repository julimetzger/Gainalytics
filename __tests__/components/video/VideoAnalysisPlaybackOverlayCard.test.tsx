import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import VideoAnalysisPlaybackOverlayCard from '../../../app/components/video/VideoAnalysisPlaybackOverlayCard';
import {BarTrackingResult} from '../../../app/models/entities/VideoAnalysis';

jest.mock('react-native-charts-wrapper', () => ({
  LineChart: 'LineChart',
}));

interface MakeResultOverrides {
  analysisMeta?: Partial<BarTrackingResult['analysisMeta']>;
  barPathSeries?: BarTrackingResult['barPathSeries'];
  confidenceSeries?: BarTrackingResult['confidenceSeries'];
  repSegments?: BarTrackingResult['repSegments'];
  repMetrics?: BarTrackingResult['repMetrics'];
  qualityFlags?: BarTrackingResult['qualityFlags'];
}

const makeResult = (overrides: MakeResultOverrides = {}): BarTrackingResult => {
  const baseResult = {
    analysisId: 1,
    units: 'px/s',
    barPathSeries: [
      {tMs: 0, x: 100, y: 200},
      {tMs: 500, x: 110, y: 210},
      {tMs: 1000, x: 120, y: 220},
      {tMs: 1500, x: 130, y: 230},
      {tMs: 2000, x: 140, y: 240},
    ],
    confidenceSeries: [],
    repSegments: [],
    repMetrics: [],
    qualityFlags: [],
    analysisMeta: {
      sourceFps: 30,
      analyzedFps: 30,
      frameCount: 60,
      averageConfidence: 0.9,
      trackingFrameWidthPx: 640,
      trackingFrameHeightPx: 480,
    },
  } satisfies BarTrackingResult;

  return {
    ...baseResult,
    ...overrides,
    analysisMeta: {
      ...baseResult.analysisMeta,
      ...overrides.analysisMeta,
    },
  };
};

const loadPlayer = (player: any, durationMs = 3000) => {
  act(() => {
    player.props.onLoad({nativeEvent: {durationMs, videoWidth: 640, videoHeight: 480}});
  });
};

const progressPlayer = (player: any, currentTimeMs: number, durationMs = 3000) => {
  act(() => {
    player.props.onProgress({nativeEvent: {currentTimeMs, durationMs}});
  });
};

const setScrubberWidth = (scrubber: any, width: number) => {
  act(() => {
    scrubber.props.onLayout({nativeEvent: {layout: {width}}});
  });
};

const getScrubberState = (getByTestId: (testId: string) => any) => {
  const scrubberFill = getByTestId('video-analysis-playback-scrubber-fill');
  const scrubberThumb = getByTestId('video-analysis-playback-scrubber-thumb');
  const fillStyle = StyleSheet.flatten(scrubberFill.props.style);
  const thumbStyle = StyleSheet.flatten(scrubberThumb.props.style);

  return {
    fillWidth: fillStyle.width,
    thumbLeft: thumbStyle.left,
  };
};

describe('VideoAnalysisPlaybackOverlayCard – step buttons', () => {
  it('renders four step buttons with correct labels', () => {
    const {getByTestId, getByText} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    expect(getByTestId('video-analysis-step-minus200')).toBeTruthy();
    expect(getByTestId('video-analysis-step-minus50')).toBeTruthy();
    expect(getByTestId('video-analysis-step-plus50')).toBeTruthy();
    expect(getByTestId('video-analysis-step-plus200')).toBeTruthy();

    expect(getByText('-0.2s')).toBeTruthy();
    expect(getByText('-0.05s')).toBeTruthy();
    expect(getByText('+0.05s')).toBeTruthy();
    expect(getByText('+0.2s')).toBeTruthy();
  });

  it('+0.2s button seeks forward 200ms from current time', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player);
    progressPlayer(player, 1000);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus200'));
    });

    expect(player.props.seekPositionMs).toBe(1200);
    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '40%',
      thumbLeft: '40%',
    });
  });

  it('-0.2s button seeks backward 200ms from current time', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player);
    progressPlayer(player, 1000);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-minus200'));
    });

    expect(player.props.seekPositionMs).toBe(800);
  });

  it('+0.05s button seeks forward 50ms from current time', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player);
    progressPlayer(player, 1000);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus50'));
    });

    expect(player.props.seekPositionMs).toBe(1050);
  });

  it('-0.05s button seeks backward 50ms from current time', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player);
    progressPlayer(player, 1000);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-minus50'));
    });

    expect(player.props.seekPositionMs).toBe(950);
  });

  it('step button clamps to 0 when seeking before start', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player, 3000);
    progressPlayer(player, 100);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-minus200'));
    });

    expect(player.props.seekPositionMs).toBe(0);
  });

  it('step button clamps to duration when seeking past end', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player, 3000);
    progressPlayer(player, 2900);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus200'));
    });

    expect(player.props.seekPositionMs).toBe(3000);
  });
});

describe('VideoAnalysisPlaybackOverlayCard – scrubber time update', () => {
  it('playback time display updates to reflect progress event', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player, 60000);
    progressPlayer(player, 5000);

    const timeDisplay = getByTestId('video-analysis-playback-time');
    // 5000ms = 00:05
    expect(timeDisplay.props.children.join('')).toContain('00:05');
  });

  it('seek via step button updates playback time display', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player, 60000);
    progressPlayer(player, 5000);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus200'));
    });

    const timeDisplay = getByTestId('video-analysis-playback-time');
    // 5200ms = 00:05 (same minute/second bucket, but seekPositionMs is updated)
    expect(player.props.seekPositionMs).toBe(5200);
    // Time display shows the seeked value (5200ms → still "00:05")
    expect(timeDisplay.props.children.join('')).toContain('00:05');
  });

  it('tapping the speed chart seeks the player and updates the scrubber immediately', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');

    loadPlayer(player, 3000);

    act(() => {
      fireEvent(getByTestId('video-analysis-playback-speed-plot'), 'onSelect', {
        nativeEvent: {x: 1500},
      });
    });

    expect(player.props.seekPositionMs).toBe(1500);
    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '50%',
      thumbLeft: '50%',
    });
  });

  it('scrubber drag ignores stale native progress while the user is dragging', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);

    act(() => {
      scrubber.props.onResponderGrant({nativeEvent: {locationX: 75}});
    });

    progressPlayer(player, 1200, 3000);

    expect(player.props.seekPositionMs).toBe(2250);
    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '75%',
      thumbLeft: '75%',
    });

    act(() => {
      scrubber.props.onResponderRelease();
    });

    progressPlayer(player, 1600, 3000);

    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '75%',
      thumbLeft: '75%',
    });
  });
});

describe('VideoAnalysisPlaybackOverlayCard – rep path overlay', () => {
  it('renders the active rep path once playback enters a detected rep', () => {
    const {getByTestId, queryByTestId, getByText} = render(
      <VideoAnalysisPlaybackOverlayCard
        localVideoPath="/test/video.mp4"
        result={makeResult({
          barPathSeries: [
            {tMs: 0, x: 100, y: 140},
            {tMs: 500, x: 110, y: 180},
            {tMs: 1000, x: 120, y: 220},
            {tMs: 1500, x: 130, y: 180},
            {tMs: 2000, x: 140, y: 140},
          ],
          repSegments: [{repIndex: 1, startMs: 0, bottomMs: 1000, endMs: 2000}],
          repMetrics: [
            {
              repIndex: 1,
              averageConcentricSpeedPxPerS: 80,
              lowestConcentricSpeedPxPerS: 60,
              repTimeMs: 2000,
            },
          ],
        })}
      />,
    );

    const player = getByTestId('video-analysis-playback-player');
    const overlay = getByTestId('video-analysis-playback-overlay');

    act(() => {
      overlay.props.onLayout({nativeEvent: {layout: {width: 320, height: 180}}});
    });
    loadPlayer(player, 2500);

    expect(getByTestId('video-analysis-playback-full-path')).toBeTruthy();
    expect(queryByTestId('video-analysis-playback-active-rep-path')).toBeNull();

    progressPlayer(player, 1000, 2500);

    expect(getByTestId('video-analysis-playback-active-rep-path')).toBeTruthy();
    expect(getByText('Current Rep: 1')).toBeTruthy();
  });
});
