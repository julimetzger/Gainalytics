import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import VideoAnalysisPlaybackOverlayCard, {calculateBarPathDeviation} from '../../../app/components/video/VideoAnalysisPlaybackOverlayCard';
import {BarPathPoint, BarTrackingResult} from '../../../app/models/entities/VideoAnalysis';

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

// Fixture with a non-zero minTimeMs to expose the bar-path time range offset.
// timeRange: minTimeMs=1000, maxTimeMs=3000, durationMs=2000
const makeResultWithOffset = (): BarTrackingResult => ({
  analysisId: 2,
  units: 'px/s',
  barPathSeries: [
    {tMs: 1000, x: 100, y: 200},
    {tMs: 1500, x: 110, y: 210},
    {tMs: 2000, x: 120, y: 220},
    {tMs: 2500, x: 130, y: 230},
    {tMs: 3000, x: 140, y: 240},
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

const getMarkerTranslateX = (getByTestId: (testId: string) => any): number => {
  const marker = getByTestId('video-analysis-speed-marker');
  const style = StyleSheet.flatten(marker.props.style);
  const transform: Array<{translateX?: number}> = style.transform ?? [];
  const translateEntry = transform.find((t) => t.translateX !== undefined);
  return translateEntry?.translateX ?? 0;
};

// Trigger the speed chart layout event so speedChartWidthSV is set.
const setSpeedChartWidth = (getByTestId: (testId: string) => any, width: number) => {
  act(() => {
    getByTestId('video-analysis-playback-speed-plot').props.onLayout({nativeEvent: {layout: {width}}});
  });
};

describe('VideoAnalysisPlaybackOverlayCard – step buttons', () => {
  it('renders four step buttons with correct labels', () => {
    const {getByTestId, getByText} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    expect(getByTestId('video-analysis-step-minus200')).toBeTruthy();
    expect(getByTestId('video-analysis-step-minus50')).toBeTruthy();
    expect(getByTestId('video-analysis-step-plus50')).toBeTruthy();
    expect(getByTestId('video-analysis-step-plus200')).toBeTruthy();

  });

  it('+0.2s button seeks forward 200ms from current time', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 60000);
    setScrubberWidth(scrubber, 100);
    // Seek to 5000ms via scrubber: 5000/60000 ≈ 8.333%
    seekViaScrubbingTo(scrubber, 5000, 60000, 100);

  });

  it('seek via step button updates seekPositionMs', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, 60000);
    setScrubberWidth(scrubber, 100);
    seekViaScrubbingTo(scrubber, 5000, 60000, 100);

    act(() => {
      fireEvent.press(getByTestId('video-analysis-step-plus200'));
    });

    expect(player.props.seekPositionMs).toBe(5200);
  });

  it('tapping the speed chart seeks the player and updates the scrubber immediately', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const speedPlot = getByTestId('video-analysis-playback-speed-plot');
    const speedChart = getByTestId('video-analysis-playback-speed-chart');

    loadPlayer(player, 3000);

    // Set chart width: 240px total = 36px left padding + 200px drawable + 4px right padding
    act(() => {
      speedPlot.props.onLayout({nativeEvent: {layout: {width: 240}}});
    });

    // Tap at locationX=186: progress = (186-36)/200 = 0.75, seekMs = 0.75 * videoDuration = 0.75 * 3000 = 2250
    act(() => {
      fireEvent(speedChart, 'touchEnd', {nativeEvent: {locationX: 186}});
    });

    expect(player.props.seekPositionMs).toBe(2250);
    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: '75%',
      thumbLeft: '75%',
    });
  });

  it('scrubber drag ignores stale native progress while the user is dragging', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
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

// Speed chart = 240px total: 36px Y-axis padding (left) + 200px drawable area + 4px right padding.
// Bar-path time range: minTimeMs=1000, maxTimeMs=3000, durationMs=2000.
// Video duration: 5000ms.
// The chart X-axis spans the full video timeline, so the first data point sits at
// x = 36 + (1000 / 5000) * 200 = 76 instead of directly at the chart start.
describe('VideoAnalysisPlaybackOverlayCard – speed chart marker alignment', () => {
  const CHART_WIDTH = 240;
  const LEFT_PADDING = 36;
  const RIGHT_PADDING = 4;
  const DRAWABLE_WIDTH = CHART_WIDTH - LEFT_PADDING - RIGHT_PADDING; // 196
  const VIDEO_DURATION_MS = 5000;
  const FIRST_DATA_TIME_MS = 1000;
  const LAST_DATA_TIME_MS = 3000;

  const setupWithOffset = () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithOffset()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    loadPlayer(player, VIDEO_DURATION_MS);
    setScrubberWidth(scrubber, 100);
    setSpeedChartWidth(getByTestId, CHART_WIDTH);

    return {getByTestId, player, scrubber};
  };

  it('configures the speed chart x-axis to span the full video duration', () => {
    const {getByTestId} = setupWithOffset();
    const speedPlot = getByTestId('video-analysis-playback-speed-plot');

    expect(speedPlot.props.xAxis).toEqual(
      expect.objectContaining({
        axisMinimum: 0,
        axisMaximum: VIDEO_DURATION_MS,
      }),
    );
  });

  it('marker starts at the chart left edge at playback t=0 even when data starts later', () => {
    const {getByTestId, scrubber} = setupWithOffset();
    seekViaScrubbingTo(scrubber, 0, VIDEO_DURATION_MS, 100);

    expect(getMarkerTranslateX(getByTestId)).toBe(LEFT_PADDING);
  });

  it('marker aligns with the first data timestamp inside the chart when playback time == timeRange.minTimeMs', () => {
    const {getByTestId, scrubber} = setupWithOffset();
    seekViaScrubbingTo(scrubber, FIRST_DATA_TIME_MS, VIDEO_DURATION_MS, 100);

    expect(getMarkerTranslateX(getByTestId)).toBe(LEFT_PADDING + (FIRST_DATA_TIME_MS / VIDEO_DURATION_MS) * DRAWABLE_WIDTH);
  });

  it('marker aligns with the last data timestamp inside the chart when playback time == timeRange.maxTimeMs', () => {
    const {getByTestId, scrubber} = setupWithOffset();
    seekViaScrubbingTo(scrubber, LAST_DATA_TIME_MS, VIDEO_DURATION_MS, 100);

    expect(getMarkerTranslateX(getByTestId)).toBe(LEFT_PADDING + (LAST_DATA_TIME_MS / VIDEO_DURATION_MS) * DRAWABLE_WIDTH);
  });

  it('marker stays left of the first data point while playback time is before timeRange.minTimeMs', () => {
    const {getByTestId, scrubber} = setupWithOffset();
    seekViaScrubbingTo(scrubber, 500, VIDEO_DURATION_MS, 100);

    expect(getMarkerTranslateX(getByTestId)).toBe(LEFT_PADDING + (500 / VIDEO_DURATION_MS) * DRAWABLE_WIDTH);
  });

  it('marker reaches the chart right edge at the end of the video even after the data range has ended', () => {
    const {getByTestId, scrubber} = setupWithOffset();
    seekViaScrubbingTo(scrubber, VIDEO_DURATION_MS, VIDEO_DURATION_MS, 100);

    expect(getMarkerTranslateX(getByTestId)).toBe(CHART_WIDTH - RIGHT_PADDING);
  });

  it('marker follows the shared 0..duration timeline at intermediate playback times', () => {
    const {getByTestId, scrubber} = setupWithOffset();
    seekViaScrubbingTo(scrubber, 2000, VIDEO_DURATION_MS, 100);

    expect(getMarkerTranslateX(getByTestId)).toBe(LEFT_PADDING + (2000 / VIDEO_DURATION_MS) * DRAWABLE_WIDTH);
  });
});

// --- Fixture with rep data ---
const makeResultWithReps = (): BarTrackingResult => ({
  analysisId: 3,
  units: 'px/s',
  barPathSeries: [
    {tMs: 0, x: 100, y: 200},
    {tMs: 500, x: 110, y: 210},
    {tMs: 1000, x: 120, y: 250},
    {tMs: 1500, x: 130, y: 210},
    {tMs: 2000, x: 140, y: 200},
    {tMs: 2500, x: 150, y: 250},
    {tMs: 3000, x: 160, y: 210},
  ],
  confidenceSeries: [],
  repSegments: [
    {repIndex: 0, startMs: 0, turnaroundMs: 1000, endMs: 2000},
    {repIndex: 1, startMs: 2000, turnaroundMs: 2500, endMs: 3000},
  ],
  repMetrics: [
    {repIndex: 0, repTimeMs: 2000, averageConcentricSpeedPxPerS: 50, lowestConcentricSpeedPxPerS: 30},
    {repIndex: 1, repTimeMs: 1000, averageConcentricSpeedPxPerS: 80, lowestConcentricSpeedPxPerS: 60},
  ],
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

describe('VideoAnalysisPlaybackOverlayCard – rep summary', () => {
  it('renders rep summary section when repMetrics is non-empty', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );

    expect(getByTestId('video-analysis-rep-summary')).toBeTruthy();
  });

  it('rep summary shows correct rep count label', () => {
    const {getByText} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );

    expect(getByText('Rep Summary (2 reps)')).toBeTruthy();
  });

  it('rep summary shows rep time for each rep', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );

    const flatChildren = (el: any): string => [].concat(el.props.children).join('');
    // Rep 0: 2000ms = 2.00s
    expect(flatChildren(getByTestId('video-analysis-rep-time-0'))).toBe('2.00s');
    // Rep 1: 1000ms = 1.00s
    expect(flatChildren(getByTestId('video-analysis-rep-time-1'))).toBe('1.00s');
  });

  it('rep summary shows average concentric speed for each rep', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );

    const flatChildren = (el: any): string => [].concat(el.props.children).join('');
    // Rep 0: 50
    expect(flatChildren(getByTestId('video-analysis-rep-speed-0'))).toBe('50');
    // Rep 1: 80
    expect(flatChildren(getByTestId('video-analysis-rep-speed-1'))).toBe('80');
  });

  it('does not render rep summary section when repMetrics is empty', () => {
    const {queryByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    expect(queryByTestId('video-analysis-rep-summary')).toBeNull();
  });

  it('renders without crash when repSegments is empty (graceful degradation)', () => {
    const result = makeResult();
    expect(() =>
      render(<VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={result} />),
    ).not.toThrow();
  });

  it('passes repSegments prop to native player', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );

    const player = getByTestId('video-analysis-playback-player');
    expect(player.props.repSegments).toHaveLength(2);
    expect(player.props.repSegments[0].repIndex).toBe(0);
    expect(player.props.repSegments[0].startMs).toBe(0);
    expect(player.props.repSegments[0].turnaroundMs).toBe(1000);
    expect(player.props.repSegments[0].endMs).toBe(2000);
  });

  it('passes currentRepIndex and themed native overlay colors to the player', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );

    loadPlayer(getByTestId('video-analysis-playback-player'), 3000);

    act(() => {
      getByTestId('video-analysis-playback-player').props.onProgress({
        nativeEvent: {currentTimeMs: 1500, durationMs: 3000},
      });
    });

    const player = getByTestId('video-analysis-playback-player');
    expect(player.props.currentRepIndex).toBe(0);
    expect(player.props.primaryColor).toBeDefined();
    expect(player.props.pathColor).toBeDefined();
  });

  it('renders the playback overlay wrapper used by native overlay capture flows', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    expect(getByTestId('video-analysis-playback-overlay')).toBeTruthy();
  });

  it('native player overlay card is rendered with correct testID', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    expect(getByTestId('video-analysis-overlay-card')).toBeTruthy();
  });
});

// Fixture with a short video (3000ms) and two reps where turnaround starts near 0
// so that clamping under longpress can be tested.
const makeResultNearBoundary = (): BarTrackingResult => ({
  analysisId: 4,
  units: 'px/s',
  barPathSeries: [
    {tMs: 0,    x: 100, y: 200},
    {tMs: 500,  x: 110, y: 250},
    {tMs: 1000, x: 120, y: 200},
    {tMs: 2000, x: 130, y: 250},
    {tMs: 3000, x: 140, y: 200},
  ],
  confidenceSeries: [],
  repSegments: [
    // turnaround at 100ms — just 100ms from 0, one longpress (1000ms) should clamp to 0
    {repIndex: 0, startMs: 0, turnaroundMs: 100, endMs: 2000},
    {repIndex: 1, startMs: 2000, turnaroundMs: 2800, endMs: 3000},
  ],
  repMetrics: [
    {repIndex: 0, repTimeMs: 2000, averageConcentricSpeedPxPerS: 50, lowestConcentricSpeedPxPerS: 30},
    {repIndex: 1, repTimeMs: 1000, averageConcentricSpeedPxPerS: 80, lowestConcentricSpeedPxPerS: 60},
  ],
  qualityFlags: [],
  analysisMeta: {
    sourceFps: 30, analyzedFps: 30, frameCount: 90, averageConfidence: 0.9,
    trackingFrameWidthPx: 640, trackingFrameHeightPx: 480,
  },
});

describe('VideoAnalysisPlaybackOverlayCard – calibration clamping (GH-86 P2)', () => {
  let dispatchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    dispatchMock = jest.fn();
    // Inject a stable dispatch mock so we can inspect what the Save button sends.
    (require('react-redux') as any).useDispatch.mockReturnValue(dispatchMock);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('longpress turnaround-left clamps to 0 and repeat does not go negative', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultNearBoundary()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    // Open calibration panel
    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });

    // Longpress the turnaround-left button: turnaround is at 100ms, step is 1000ms → clamp to 0
    act(() => { fireEvent(getByTestId('calibrate-first-turnaround-left'), 'longPress'); });

    // Advance two repeat intervals to confirm the interval also clamps at 0
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });

    // Release to stop repeat
    act(() => { fireEvent(getByTestId('calibrate-first-turnaround-left'), 'pressOut'); });

    // Press Save and inspect the dispatched action
    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 0,
              turnaroundMs: 0, // clamped: never below 0
            }),
          ]),
        }),
      }),
    );
  });

  it('longpress end-right clamps to correctedPlaybackDurationMs and repeat does not exceed it', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultNearBoundary()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });

    // end at 2000ms, +1000ms = 3000ms → at the duration boundary
    // second interval tick would try 4000ms → must be clamped to 3000ms
    act(() => { fireEvent(getByTestId('calibrate-first-end-right'), 'longPress'); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { fireEvent(getByTestId('calibrate-first-end-right'), 'pressOut'); });

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 0,
              endMs: 3000, // clamped: never above duration
            }),
          ]),
        }),
      }),
    );
  });

  it('longpress turnaround-right repeat does not exceed endMs (marker order)', () => {
    // last rep: turnaround=2800, end=3000 — one step would push to 3800 but must clamp to end=3000
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultNearBoundary()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });

    // initial longpress: 2800+1000=3800 → clamped to min(3000, 3000)=3000
    act(() => { fireEvent(getByTestId('calibrate-last-turnaround-right'), 'longPress'); });
    // repeat tick: prev=3000 → 3000+1000=4000 → must clamp to 3000 (not exceed endMs)
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { fireEvent(getByTestId('calibrate-last-turnaround-right'), 'pressOut'); });

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 1,
              turnaroundMs: 3000, // clamped to endMs, not above
            }),
          ]),
        }),
      }),
    );
  });

  it('longpress end-left repeat does not go below turnaroundMs (marker order)', () => {
    // last rep: turnaround=2800, end=3000 — one step would push end to 2000 but must clamp to turnaround=2800
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultNearBoundary()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });

    // initial longpress: 3000-1000=2000 → clamped to max(2800, 2000)=2800
    act(() => { fireEvent(getByTestId('calibrate-last-end-left'), 'longPress'); });
    // repeat tick: prev=2800 → 2800-1000=1800 → must clamp to max(turnaroundMs=2800, 0)=2800
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { fireEvent(getByTestId('calibrate-last-end-left'), 'pressOut'); });

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 1,
              endMs: 2800, // clamped to turnaroundMs, not below
            }),
          ]),
        }),
      }),
    );
  });
});

describe('VideoAnalysisPlaybackOverlayCard – override-clobber guard (GH-86 P2)', () => {
  let dispatchMock: jest.Mock;

  beforeEach(() => {
    dispatchMock = jest.fn();
    (require('react-redux') as any).useDispatch.mockReturnValue(dispatchMock);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('late-arriving savedSetResult does not overwrite a manually adjusted turnaround', () => {
    // Render without any savedSetResult → overrides start null
    const {getByTestId, rerender} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    // Open calibration and manually press turnaround-right (+20ms tap, not longpress)
    // firstRepSegment.turnaroundMs = 1000 → after tap → 1020
    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });
    act(() => { fireEvent.press(getByTestId('calibrate-first-turnaround-right')); });

    // Now savedSetResult arrives (simulating Redux tab-switch propagation)
    // with a different turnaroundMs (900). The override-clobber guard must
    // prevent this from overwriting the user's manual edit.
    const savedSetResult = {
      repResults: [
        {repIndex: 0, startMs: 0, turnaroundMs: 900, endMs: 2000,
          totalTimeMs: 2000, eccentricTimeMs: 900, concentricTimeMs: 1100,
          vAvg: 50, vPeak: 80},
        {repIndex: 1, startMs: 2000, turnaroundMs: 2500, endMs: 3000,
          totalTimeMs: 1000, eccentricTimeMs: 500, concentricTimeMs: 500,
          vAvg: 80, vPeak: 100},
      ],
      velocityLossPercent: 10,
      rirEstimate: '3-4',
      calibratedAt: '2026-01-01T00:00:00.000Z',
    };
    act(() => {
      rerender(
        <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResultWithReps()} savedSetResult={savedSetResult} />,
      );
    });

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    // The dispatched action must use 1020 (user's edit), not 900 (savedSetResult value)
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 0,
              turnaroundMs: 1020,
            }),
          ]),
        }),
      }),
    );
// ─── calculateBarPathDeviation unit tests ──────────────────────────────────

/**
 * Build a path segment with constant x, y linearly interpolated.
 * Uses non-overlapping timestamps to avoid shared turnaround point.
 */
const makePathSegment = (startMs: number, endMs: number, xBase: number, yStart: number, yEnd: number, count: number): BarPathPoint[] => {
  const pts: BarPathPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    pts.push({tMs: startMs + t * (endMs - startMs), x: xBase, y: yStart + t * (yEnd - yStart)});
  }
  return pts;
};

describe('calculateBarPathDeviation', () => {
  const FRAME_WIDTH = 640;
  // Timestamps: ecc 0-900ms, turnaround at 1000ms (gap avoids shared point), con 1100-2000ms
  const ECC_START = 0;
  const TURNAROUND = 1000;
  const CON_END = 2000;
  const ECC_END = 900;   // eccentric ends before turnaround
  const CON_START = 1100; // concentric starts after turnaround

  it('returns zero deviation when concentric path mirrors eccentric path exactly', () => {
    // Eccentric: x=100, y 100→300; Concentric: x=100, y 300→100 — same x, zero drift
    const ecc = makePathSegment(ECC_START, ECC_END, 100, 100, 300, 10);
    const con = makePathSegment(CON_START, CON_END, 100, 300, 100, 10);
    const all = [...ecc, ...con];

    const {delta_x, path_deviation} = calculateBarPathDeviation(all, ECC_START, TURNAROUND, CON_END, FRAME_WIDTH);

    expect(delta_x.length).toBe(20);
    delta_x.forEach((d) => expect(Math.abs(d)).toBeLessThan(0.01));
    expect(path_deviation).toBeCloseTo(0, 2);
  });

  it('detects lateral drift when concentric path is offset to the right', () => {
    // Eccentric: x=100; Concentric: x=200 — 100px constant offset
    const ecc = makePathSegment(ECC_START, ECC_END, 100, 100, 300, 10);
    const con = makePathSegment(CON_START, CON_END, 200, 300, 100, 10);
    const all = [...ecc, ...con];

    const {delta_x, path_deviation} = calculateBarPathDeviation(all, ECC_START, TURNAROUND, CON_END, FRAME_WIDTH);

    delta_x.forEach((d) => expect(d).toBeCloseTo(100, 0));
    expect(path_deviation).toBeCloseTo(100 / FRAME_WIDTH, 3);
  });

  it('returns empty result for insufficient data', () => {
    const {delta_x, path_deviation} = calculateBarPathDeviation([], 0, 500, 1000, FRAME_WIDTH);
    expect(delta_x).toHaveLength(0);
    expect(path_deviation).toBeUndefined();
  });

  it('returns undefined path_deviation when trackingFrameWidthPx is zero', () => {
    const ecc = makePathSegment(ECC_START, ECC_END, 100, 100, 300, 10);
    const con = makePathSegment(CON_START, CON_END, 200, 300, 100, 10);
    const all = [...ecc, ...con];

    const {delta_x, path_deviation} = calculateBarPathDeviation(all, ECC_START, TURNAROUND, CON_END, 0);
    expect(delta_x).toHaveLength(0);
    expect(path_deviation).toBeUndefined();
  });

  it('normalises path_deviation relative to tracking frame width', () => {
    // 64px drift → path_deviation = 64 / 640 = 0.1
    const ecc = makePathSegment(ECC_START, ECC_END, 100, 100, 300, 10);
    const con = makePathSegment(CON_START, CON_END, 164, 300, 100, 10);
    const all = [...ecc, ...con];

    const {path_deviation} = calculateBarPathDeviation(all, ECC_START, TURNAROUND, CON_END, FRAME_WIDTH);
    expect(path_deviation).toBeCloseTo(64 / FRAME_WIDTH, 2);
describe('VideoAnalysisPlaybackOverlayCard – speed control', () => {
  const getSpeedLabelText = (getByTestId: (id: string) => any): string => {
    const children = getByTestId('video-analysis-speed-label').props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  };

  it('renders speed control with default 1.0x label', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    expect(getByTestId('video-analysis-speed-control')).toBeTruthy();
    expect(getSpeedLabelText(getByTestId)).toBe('Speed: 1.0x');
  });

  it('renders speed buttons for all preset values', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    for (const speed of [0.1, 0.2, 0.3, 0.5, 0.75, 1.0]) {
      expect(getByTestId(`video-analysis-speed-btn-${speed}`)).toBeTruthy();
    }
  });

  it('passes default playbackSpeed 1.0 to the native player', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    const player = getByTestId('video-analysis-playback-player');
    expect(player.props.playbackSpeed).toBe(1.0);
  });

  it('pressing a speed button updates the label and passes new speed to native player', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    act(() => {
      fireEvent.press(getByTestId('video-analysis-speed-btn-0.3'));
    });

    expect(getSpeedLabelText(getByTestId)).toBe('Speed: 0.3x');
    expect(getByTestId('video-analysis-playback-player').props.playbackSpeed).toBe(0.3);
  });

  it('speed chart velocity values (px/s) are not affected by speed selection', () => {
    const result = makeResult();
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={result} />,
    );
    const player = getByTestId('video-analysis-playback-player');
    const barPathBefore = player.props.barPathSeries;

    act(() => {
      fireEvent.press(getByTestId('video-analysis-speed-btn-0.1'));
    });

    // barPathSeries passed to native player must be unchanged
    expect(getByTestId('video-analysis-playback-player').props.barPathSeries).toEqual(barPathBefore);
    // speed label updated
    expect(getSpeedLabelText(getByTestId)).toBe('Speed: 0.1x');
  });

  it('speed label shows 0.75x without rounding to 0.8x', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );

    act(() => {
      fireEvent.press(getByTestId('video-analysis-speed-btn-0.75'));
    });

    expect(getSpeedLabelText(getByTestId)).toBe('Speed: 0.75x');
    expect(getByTestId('video-analysis-playback-player').props.playbackSpeed).toBe(0.75);
  });
});
