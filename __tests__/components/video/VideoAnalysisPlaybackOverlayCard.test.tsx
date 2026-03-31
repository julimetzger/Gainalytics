import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import VideoAnalysisPlaybackOverlayCard from '../../../app/components/video/VideoAnalysisPlaybackOverlayCard';
import {BarTrackingResult} from '../../../app/models/entities/VideoAnalysis';

jest.mock('react-native-charts-wrapper', () => ({
  LineChart: 'LineChart',
}));

const makeResult = (): BarTrackingResult => ({
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
});

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

// Helper: seek to a specific time via scrubber drag.
// Requires scrubber width to be set first via setScrubberWidth.
const seekViaScrubbingTo = (scrubber: any, timeMs: number, durationMs: number, scrubberWidthPx: number) => {
  const locationX = (timeMs / durationMs) * scrubberWidthPx;
  act(() => {
    scrubber.props.onResponderGrant({nativeEvent: {locationX}});
  });
  act(() => {
    scrubber.props.onResponderRelease();
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
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    // Set initial position to 1000ms via scrubber (onPlayerProgress no longer drives time).
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 1000, 3000, 100);

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
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 1000, 3000, 100);

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
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 1000, 3000, 100);

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
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 1000, 3000, 100);

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
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 100, 3000, 100);

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
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 2900, 3000, 100);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus200'));
    });

    expect(player.props.seekPositionMs).toBe(3000);
  });
});

describe('VideoAnalysisPlaybackOverlayCard – scrubber time update', () => {
  it('playback time display updates after seek (onPlayerProgress no longer drives time)', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 60000);
    setScrubberWidth(scrubber, 100);
    // Seek to 5000ms via scrubber: 5000/60000 ≈ 8.333%
    seekViaScrubbingTo(scrubber, 5000, 60000, 100);

    const timeDisplay = getByTestId('video-analysis-playback-time');
    // 5000ms = 00:05
    expect(timeDisplay.props.children.join('')).toContain('00:05');
  });

  it('seek via step button updates playback time display', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 60000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 5000, 60000, 100);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus200'));
    });

    const timeDisplay = getByTestId('video-analysis-playback-time');
    // 5200ms = 00:05
    expect(player.props.seekPositionMs).toBe(5200);
    expect(timeDisplay.props.children.join('')).toContain('00:05');
  });

  it('tapping the speed chart seeks the player and updates the scrubber immediately', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const speedPlot = getByTestId('video-analysis-playback-speed-plot');
    const speedChart = getByTestId('video-analysis-playback-speed-chart');

    loadPlayer(player, 3000);

    // Set chart width: 248px total = 48px left padding + 200px drawable
    act(() => {
      speedPlot.props.onLayout({nativeEvent: {layout: {width: 248}}});
    });

    // Tap at locationX=198: progress = (198-48)/200 = 0.75, seekMs = 0.75 * videoDuration = 0.75 * 3000 = 2250
    act(() => {
      fireEvent(speedChart, 'touchEnd', {nativeEvent: {locationX: 198}});
    });

    expect(player.props.seekPositionMs).toBe(2250);
    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '75%',
      thumbLeft: '75%',
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

    // onPlayerProgress no longer updates playback time — scrubber position unchanged.
    progressPlayer(player, 1200, 3000);

    expect(player.props.seekPositionMs).toBe(2250);
    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '75%',
      thumbLeft: '75%',
    });

    act(() => {
      scrubber.props.onResponderRelease();
    });

    // Even after release, onPlayerProgress still does not update playback time.
    progressPlayer(player, 1600, 3000);

    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '75%',
      thumbLeft: '75%',
    });
  });
});
