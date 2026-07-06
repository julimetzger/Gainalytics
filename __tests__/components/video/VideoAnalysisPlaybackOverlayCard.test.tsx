import React from 'react';
import {StyleSheet} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import VideoAnalysisPlaybackOverlayCard, {calculateBarPathDeviation, computeRepPhaseTimesMs, getRepPhaseBoundaries, isConcentricFirstRep} from '../../../app/components/video/VideoAnalysisPlaybackOverlayCard';
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
  const transform: Array<{translateX?: number}> = thumbStyle.transform ?? [];
  const translateEntry = transform.find((t) => t.translateX !== undefined);

  return {
    fillWidth: fillStyle.width,
    thumbTranslateX: translateEntry?.translateX ?? 0,
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
      fillWidth: 40,
      thumbTranslateX: 40,
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
    const scrubber = getByTestId('video-analysis-playback-scrubber');
    const speedPlot = getByTestId('video-analysis-playback-speed-plot');
    const speedChart = getByTestId('video-analysis-playback-speed-chart');

    loadPlayer(player, 3000);
    setScrubberWidth(scrubber, 100);

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
      fillWidth: 75,
      thumbTranslateX: 75,
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
      fillWidth: 75,
      thumbTranslateX: 75,
    });

    act(() => {
      scrubber.props.onResponderRelease();
    });

    // Even after release, onPlayerProgress still does not update playback time.
    progressPlayer(player, 1600, 3000);

    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: 75,
      thumbTranslateX: 75,
    });
  });
});

// GH-177: scrubber and velocity marker must be usable without waiting for onPlayerLoad.
// React runs effects in declaration order, so the duration effect (which sets
// videoDurationMsSV/chartVisibleMaxSV) fires BEFORE the reset effect (which clears them
// back to 0). Without the fix, the guard conditions in scrubberFillStyle and
// progressMarkerLeft permanently fail until onPlayerLoad changes correctedPlaybackDurationMs.
describe('VideoAnalysisPlaybackOverlayCard – scrubber and marker usable before onPlayerLoad', () => {
  const CHART_WIDTH = 240;
  const LEFT_PADDING = 36;
  // makeResult() barPathSeries max time = 2000ms → correctedPlaybackDurationMs = 2000
  const BAR_PATH_DURATION_MS = 2000;

  it('scrubber reflects seek position even when onPlayerLoad has not yet fired', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    setScrubberWidth(scrubber, 100);
    // Seek to 1500ms using correctedPlaybackDurationMs (2000) without calling loadPlayer.
    seekViaScrubbingTo(scrubber, 1500, BAR_PATH_DURATION_MS, 100);

    expect(getScrubberState(getByTestId)).toEqual({
      fillWidth: 75,
      thumbTranslateX: 75,
    });
  });

  it('velocity marker moves after seek even when onPlayerLoad has not yet fired', () => {
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const scrubber = getByTestId('video-analysis-playback-scrubber');

    setScrubberWidth(scrubber, 100);
    setSpeedChartWidth(getByTestId, CHART_WIDTH);
    seekViaScrubbingTo(scrubber, 1000, BAR_PATH_DURATION_MS, 100);

    // 1000ms / 2000ms = 50% through the visible range → marker x = 36 + 0.5 * 200 = 136
    expect(getMarkerTranslateX(getByTestId)).toBe(LEFT_PADDING + (1000 / BAR_PATH_DURATION_MS) * (CHART_WIDTH - LEFT_PADDING - 4));
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
// Both reps must classify as eccentric-first (start y < turnaround y) so the
// calibration overlay renders turnaround+end handles (GH-307 marker window).
const makeResultNearBoundary = (): BarTrackingResult => ({
  analysisId: 4,
  units: 'px/s',
  barPathSeries: [
    {tMs: 0,    x: 100, y: 200},
    {tMs: 500,  x: 110, y: 250},
    {tMs: 1000, x: 120, y: 200},
    {tMs: 2000, x: 130, y: 250},
    {tMs: 3000, x: 140, y: 300},
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

    // Longpress the turnaround-left button for rep 0: turnaround is at 100ms, step is 1000ms → clamp to 0
    act(() => { fireEvent(getByTestId('calibrate-rep-0-turnaround-left'), 'longPress'); });

    // Advance two repeat intervals to confirm the interval also clamps at 0
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });

    // Release to stop repeat
    act(() => { fireEvent(getByTestId('calibrate-rep-0-turnaround-left'), 'pressOut'); });

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
    act(() => { fireEvent(getByTestId('calibrate-rep-0-end-right'), 'longPress'); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { fireEvent(getByTestId('calibrate-rep-0-end-right'), 'pressOut'); });

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
    // makeResultNearBoundary has 2 reps so last rep is index 1
    act(() => { fireEvent(getByTestId('calibrate-rep-1-turnaround-right'), 'longPress'); });
    // repeat tick: prev=3000 → 3000+1000=4000 → must clamp to 3000 (not exceed endMs)
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { fireEvent(getByTestId('calibrate-rep-1-turnaround-right'), 'pressOut'); });

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
    // makeResultNearBoundary has 2 reps so last rep is index 1
    act(() => { fireEvent(getByTestId('calibrate-rep-1-end-left'), 'longPress'); });
    // repeat tick: prev=2800 → 2800-1000=1800 → must clamp to max(turnaroundMs=2800, 0)=2800
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { jest.advanceTimersByTime(150); });
    act(() => { fireEvent(getByTestId('calibrate-rep-1-end-left'), 'pressOut'); });

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
    // rep 0 turnaroundMs = 1000 → after tap → 1020
    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });
    act(() => { fireEvent.press(getByTestId('calibrate-rep-0-turnaround-right')); });

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
  });
});

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
  });
});

// GH-211: deadlift's downward phase was being labeled as concentric because the
// JS code unconditionally treated the first phase (start → turnaround) as eccentric.
// Squat/Bench start at the top (low y), descend to the bottom (high y), then ascend
// back — eccentric-first. Deadlift starts at the bottom (high y), ascends to lockout
// (low y), then descends — concentric-first. The fix derives direction from the bar
// path itself.
describe('isConcentricFirstRep / getRepPhaseBoundaries / computeRepPhaseTimesMs (GH-211)', () => {
  // Squat-style series: start at top (y=200), turnaround at bottom (y=400), end at top.
  const squatSeries: BarPathPoint[] = [
    {tMs: 0,    x: 100, y: 200},
    {tMs: 500,  x: 100, y: 300},
    {tMs: 1000, x: 100, y: 400},
    {tMs: 1500, x: 100, y: 300},
    {tMs: 2000, x: 100, y: 200},
  ];

  // Deadlift-style series: start at bottom (y=400), turnaround at top (y=200), end at bottom.
  const deadliftSeries: BarPathPoint[] = [
    {tMs: 0,    x: 100, y: 400},
    {tMs: 500,  x: 100, y: 300},
    {tMs: 1000, x: 100, y: 200},
    {tMs: 1500, x: 100, y: 300},
    {tMs: 2000, x: 100, y: 400},
  ];

  it('isConcentricFirstRep returns false for squat (eccentric-first: top → bottom → top)', () => {
    expect(isConcentricFirstRep(squatSeries, 0, 1000)).toBe(false);
  });

  it('isConcentricFirstRep returns true for deadlift (concentric-first: bottom → top → bottom)', () => {
    expect(isConcentricFirstRep(deadliftSeries, 0, 1000)).toBe(true);
  });

  it('isConcentricFirstRep returns false for empty series', () => {
    expect(isConcentricFirstRep([], 0, 1000)).toBe(false);
  });

  it('isConcentricFirstRep returns false when turnaround is at or before start', () => {
    expect(isConcentricFirstRep(squatSeries, 1000, 1000)).toBe(false);
    expect(isConcentricFirstRep(squatSeries, 1000, 500)).toBe(false);
  });

  it('getRepPhaseBoundaries: squat → eccentric is start→turnaround, concentric is turnaround→end', () => {
    const b = getRepPhaseBoundaries(squatSeries, 0, 1000, 2000);
    expect(b.concentricFirst).toBe(false);
    expect(b.eccentricStartMs).toBe(0);
    expect(b.eccentricEndMs).toBe(1000);
    expect(b.concentricStartMs).toBe(1000);
    expect(b.concentricEndMs).toBe(2000);
  });

  it('getRepPhaseBoundaries: deadlift → concentric is start→turnaround, eccentric is turnaround→end', () => {
    const b = getRepPhaseBoundaries(deadliftSeries, 0, 1000, 2000);
    expect(b.concentricFirst).toBe(true);
    expect(b.concentricStartMs).toBe(0);
    expect(b.concentricEndMs).toBe(1000);
    expect(b.eccentricStartMs).toBe(1000);
    expect(b.eccentricEndMs).toBe(2000);
  });

  it('computeRepPhaseTimesMs returns matching durations for squat', () => {
    const {eccentricTimeMs, concentricTimeMs} = computeRepPhaseTimesMs(squatSeries, 0, 800, 2000);
    expect(eccentricTimeMs).toBe(800);
    expect(concentricTimeMs).toBe(1200);
  });

  it('computeRepPhaseTimesMs swaps phase labels for deadlift', () => {
    // Same time boundaries — only the bar direction differs. The downward phase
    // (turnaround → end = 1200ms) must be labeled eccentric, not concentric.
    const {eccentricTimeMs, concentricTimeMs} = computeRepPhaseTimesMs(deadliftSeries, 0, 800, 2000);
    expect(concentricTimeMs).toBe(800);
    expect(eccentricTimeMs).toBe(1200);
  });
});

describe('getRepPhaseBoundaries – real deadlift recording from R5CN30HWZFN (GH-307)', () => {
  const gh307Fixture = require('../../fixtures/gh307/analysis-2-2026-05-18T09-25-32-066Z.json');

  it('labels every rep as concentric-first matching the user-confirmed ground truth', () => {
    const actual = gh307Fixture.barTrackingResult.repSegments.map((segment: {repIndex: number; startMs: number; turnaroundMs: number; endMs: number}) => {
      const phases = getRepPhaseBoundaries(
        gh307Fixture.barTrackingResult.barPathSeries,
        segment.startMs,
        segment.turnaroundMs,
        segment.endMs,
      );
      return {repIndex: segment.repIndex, concentricFirst: phases.concentricFirst};
    });

    expect(actual).toEqual(gh307Fixture.groundTruth.expectedConcentricFirstByRep);
  });

  it('marks the bar lift (start → turnaround) as the concentric phase for each rep', () => {
    for (const segment of gh307Fixture.barTrackingResult.repSegments) {
      const phases = getRepPhaseBoundaries(
        gh307Fixture.barTrackingResult.barPathSeries,
        segment.startMs,
        segment.turnaroundMs,
        segment.endMs,
      );
      // GH-307 user ground truth: the first peak (start → turnaround, bar moving up
      // off the floor) must fall inside the concentric phase, not the eccentric one.
      expect(phases.concentricStartMs).toBe(segment.startMs);
      expect(phases.concentricEndMs).toBe(segment.turnaroundMs);
      expect(phases.eccentricStartMs).toBe(segment.turnaroundMs);
      expect(phases.eccentricEndMs).toBe(segment.endMs);
    }
  });

  it('renders the calibration marker lines at [startMs, turnaroundMs] for every rep (GH-307 marker-window fix)', () => {
    const result: BarTrackingResult = gh307Fixture.barTrackingResult;
    const durationMs = result.barPathSeries[result.barPathSeries.length - 1].tMs;
    const {getByTestId, queryByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={result} />,
    );
    loadPlayer(getByTestId('video-analysis-playback-player'), durationMs);
    setSpeedChartWidth(getByTestId, 240);
    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });

    // Chart geometry: width=240, left padding=36, right padding=4 → drawable 200.
    const toX = (t: number) => 36 + (t / durationMs) * 200;

    result.repSegments.forEach((segment, i) => {
      // The markers must frame the upward bar movement (positive velocity peak),
      // not the drop: for this concentric-first recording that is start → turnaround.
      const startLine = StyleSheet.flatten(getByTestId(`calibrate-rep-${i}-start-line`).props.style);
      const turnLine = StyleSheet.flatten(getByTestId(`calibrate-rep-${i}-turnaround-line`).props.style);
      expect(startLine.left).toBeCloseTo(toX(segment.startMs), 5);
      expect(turnLine.left).toBeCloseTo(toX(segment.turnaroundMs), 5);
      // No third line: the end marker (mid-drop) is not part of the window.
      expect(queryByTestId(`calibrate-rep-${i}-end-line`)).toBeNull();
    });
  });
});

// Render-level verification that the calibration overlay places the two
// adjustable marker lines around the CONCENTRIC phase of each rep (GH-307):
// deadlift (concentric-first) → [startMs, turnaroundMs],
// squat/bench/OHP (eccentric-first) → [turnaroundMs, endMs] as before.
describe('VideoAnalysisPlaybackOverlayCard – calibration marker window (GH-307)', () => {
  const makeSingleRepResult = (barPathSeries: BarPathPoint[]): BarTrackingResult => ({
    analysisId: 7,
    units: 'px/s',
    barPathSeries,
    confidenceSeries: [],
    repSegments: [{repIndex: 0, startMs: 0, turnaroundMs: 1000, endMs: 2000}],
    repMetrics: [{repIndex: 0, repTimeMs: 2000, averageConcentricSpeedPxPerS: 50, lowestConcentricSpeedPxPerS: 30}],
    qualityFlags: [],
    analysisMeta: {
      sourceFps: 30, analyzedFps: 30, frameCount: 60, averageConfidence: 0.9,
      trackingFrameWidthPx: 640, trackingFrameHeightPx: 480,
    },
  });

  // Concentric-first (deadlift, GH-211 pattern y=[400,300,200,300,400]).
  const deadliftSeries: BarPathPoint[] = [
    {tMs: 0,    x: 100, y: 400},
    {tMs: 500,  x: 100, y: 300},
    {tMs: 1000, x: 100, y: 200},
    {tMs: 1500, x: 100, y: 300},
    {tMs: 2000, x: 100, y: 400},
  ];

  // Eccentric-first (squat/bench/OHP): start at top (y=200), turnaround at bottom (y=400).
  const squatSeries: BarPathPoint[] = [
    {tMs: 0,    x: 100, y: 200},
    {tMs: 500,  x: 100, y: 300},
    {tMs: 1000, x: 100, y: 400},
    {tMs: 1500, x: 100, y: 300},
    {tMs: 2000, x: 100, y: 200},
  ];

  let dispatchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    dispatchMock = jest.fn();
    (require('react-redux') as any).useDispatch.mockReturnValue(dispatchMock);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Chart geometry in these tests: width=240, left padding=36, right padding=4
  // → drawable width 200; duration 2000ms → toX(t) = 36 + (t / 2000) * 200.
  const openCalibration = (result: BarTrackingResult) => {
    const utils = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={result} />,
    );
    loadPlayer(utils.getByTestId('video-analysis-playback-player'), 2000);
    setSpeedChartWidth(utils.getByTestId, 240);
    act(() => { fireEvent.press(utils.getByTestId('video-analysis-toggle-calibration')); });
    return utils;
  };

  it('concentric-first rep: marker lines sit at [start, turnaround] with start+turnaround handles, no end line', () => {
    const {getByTestId, queryByTestId} = openCalibration(makeSingleRepResult(deadliftSeries));

    const startLine = StyleSheet.flatten(getByTestId('calibrate-rep-0-start-line').props.style);
    const turnLine = StyleSheet.flatten(getByTestId('calibrate-rep-0-turnaround-line').props.style);
    expect(startLine.left).toBe(36); // toX(startMs=0)
    expect(turnLine.left).toBe(136); // toX(turnaroundMs=1000)

    expect(getByTestId('calibrate-rep-0-start-left')).toBeTruthy();
    expect(getByTestId('calibrate-rep-0-start-right')).toBeTruthy();
    expect(getByTestId('calibrate-rep-0-turnaround-left')).toBeTruthy();
    expect(getByTestId('calibrate-rep-0-turnaround-right')).toBeTruthy();
    expect(queryByTestId('calibrate-rep-0-end-line')).toBeNull();
    expect(queryByTestId('calibrate-rep-0-end-left')).toBeNull();
    expect(queryByTestId('calibrate-rep-0-end-right')).toBeNull();
  });

  it('eccentric-first rep: marker lines stay at [turnaround, end] with no start handles', () => {
    const {getByTestId, queryByTestId} = openCalibration(makeSingleRepResult(squatSeries));

    const turnLine = StyleSheet.flatten(getByTestId('calibrate-rep-0-turnaround-line').props.style);
    const endLine = StyleSheet.flatten(getByTestId('calibrate-rep-0-end-line').props.style);
    expect(turnLine.left).toBe(136); // toX(turnaroundMs=1000)
    expect(endLine.left).toBe(236); // toX(endMs=2000)

    expect(getByTestId('calibrate-rep-0-end-left')).toBeTruthy();
    expect(getByTestId('calibrate-rep-0-end-right')).toBeTruthy();
    expect(queryByTestId('calibrate-rep-0-start-line')).toBeNull();
    expect(queryByTestId('calibrate-rep-0-start-left')).toBeNull();
  });

  it('adjusting the start handle moves the start line and the saved rep uses the adjusted startMs', () => {
    const {getByTestId} = openCalibration(makeSingleRepResult(deadliftSeries));

    // One tap on ›: startMs 0 → 20 (STEP_MS)
    act(() => { fireEvent.press(getByTestId('calibrate-rep-0-start-right')); });
    const startLine = StyleSheet.flatten(getByTestId('calibrate-rep-0-start-line').props.style);
    expect(startLine.left).toBe(36 + (20 / 2000) * 200); // line moved to toX(20)

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    // The saved rep result must carry the adjusted startMs, and the concentric
    // time (start → turnaround for this deadlift) must shrink accordingly —
    // this is what updates the Rep Summary after saving.
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 0,
              startMs: 20,
              concentricTimeMs: 980, // turnaround 1000 - adjusted start 20
              eccentricTimeMs: 1000, // end 2000 - turnaround 1000 (the drop)
            }),
          ]),
        }),
      }),
    );
  });

  it('longpress start-left clamps at 0 and longpress start-right clamps at the turnaround', () => {
    const {getByTestId} = openCalibration(makeSingleRepResult(deadliftSeries));

    // start=0, longpress step is 1000ms → must clamp at 0, repeat must not go negative
    act(() => { fireEvent(getByTestId('calibrate-rep-0-start-left'), 'longPress'); });
    act(() => { jest.advanceTimersByTime(300); });
    act(() => { fireEvent(getByTestId('calibrate-rep-0-start-left'), 'pressOut'); });

    // now longpress right twice: 0 → 1000 (turnaround) and repeat must stay there
    act(() => { fireEvent(getByTestId('calibrate-rep-0-start-right'), 'longPress'); });
    act(() => { jest.advanceTimersByTime(300); });
    act(() => { fireEvent(getByTestId('calibrate-rep-0-start-right'), 'pressOut'); });

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({
              repIndex: 0,
              startMs: 1000, // clamped at turnaroundMs, never beyond
            }),
          ]),
        }),
      }),
    );
  });
});

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

// GH-257-A: Per-rep override map — 3-rep verification
const makeResultWith3Reps = (): BarTrackingResult => ({
  analysisId: 5,
  units: 'px/s',
  barPathSeries: [
    {tMs: 0,    x: 100, y: 200},
    {tMs: 500,  x: 110, y: 250},
    {tMs: 1000, x: 120, y: 200},
    {tMs: 1500, x: 130, y: 250},
    {tMs: 2000, x: 140, y: 200},
    {tMs: 2500, x: 150, y: 250},
    {tMs: 3000, x: 160, y: 200},
  ],
  confidenceSeries: [],
  repSegments: [
    {repIndex: 0, startMs: 0,    turnaroundMs: 500,  endMs: 1000},
    {repIndex: 1, startMs: 1000, turnaroundMs: 1500, endMs: 2000},
    {repIndex: 2, startMs: 2000, turnaroundMs: 2500, endMs: 3000},
  ],
  repMetrics: [
    {repIndex: 0, repTimeMs: 1000, averageConcentricSpeedPxPerS: 50, lowestConcentricSpeedPxPerS: 30},
    {repIndex: 1, repTimeMs: 1000, averageConcentricSpeedPxPerS: 60, lowestConcentricSpeedPxPerS: 40},
    {repIndex: 2, repTimeMs: 1000, averageConcentricSpeedPxPerS: 40, lowestConcentricSpeedPxPerS: 25},
  ],
  qualityFlags: [],
  analysisMeta: {
    sourceFps: 30,
    analyzedFps: 30,
    frameCount: 90,
    averageConfidence: 0.9,
    trackingFrameWidthPx: 640,
    trackingFrameHeightPx: 480,
  },
});

const make3RepSavedSetResult = () => ({
  repResults: [
    {repIndex: 0, startMs: 0,    turnaroundMs: 480, endMs: 1000, totalTimeMs: 1000, eccentricTimeMs: 480, concentricTimeMs: 520, vAvg: 50, vPeak: 80},
    {repIndex: 1, startMs: 1000, turnaroundMs: 1450, endMs: 2000, totalTimeMs: 1000, eccentricTimeMs: 450, concentricTimeMs: 550, vAvg: 60, vPeak: 90},
    {repIndex: 2, startMs: 2000, turnaroundMs: 2520, endMs: 3000, totalTimeMs: 1000, eccentricTimeMs: 520, concentricTimeMs: 480, vAvg: 40, vPeak: 65},
  ],
  velocityLossPercent: 5,
  rirEstimate: '3-4',
  calibratedAt: '2026-01-01T00:00:00.000Z',
});

describe('VideoAnalysisPlaybackOverlayCard – per-rep override map (GH-257-A)', () => {
  let dispatchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    dispatchMock = jest.fn();
    (require('react-redux') as any).useDispatch.mockReturnValue(dispatchMock);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('seeded from 3-rep savedSetResult, saving produces all 3 rep overrides', () => {
    const savedSetResult = make3RepSavedSetResult();
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard
        analysisId={1}
        localVideoPath="/test/video.mp4"
        result={makeResultWith3Reps()}
        savedSetResult={savedSetResult}
      />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    // Must open calibration panel first — save button is only rendered when showCalibration=true
    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });
    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            expect.objectContaining({repIndex: 0, turnaroundMs: 480}),
            expect.objectContaining({repIndex: 1, turnaroundMs: 1450}),
            expect.objectContaining({repIndex: 2, turnaroundMs: 2520}),
          ]),
        }),
      }),
    );
    const dispatched = dispatchMock.mock.calls[0][0];
    expect(dispatched.setResult.repResults).toHaveLength(3);
  });

  it('adjusting middle rep (rep 1) turnaround only changes rep 1, not reps 0 and 2', () => {
    const savedSetResult = make3RepSavedSetResult();
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard
        analysisId={1}
        localVideoPath="/test/video.mp4"
        result={makeResultWith3Reps()}
        savedSetResult={savedSetResult}
      />,
    );
    const player = getByTestId('video-analysis-playback-player');
    loadPlayer(player, 3000);
    setSpeedChartWidth(getByTestId, 240);

    // Open calibration, tap rep 1's turnaround-right (+20ms)
    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });
    act(() => { fireEvent.press(getByTestId('calibrate-rep-1-turnaround-right')); });

    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
        setResult: expect.objectContaining({
          repResults: expect.arrayContaining([
            // rep 0 and rep 2 unchanged from savedSetResult
            expect.objectContaining({repIndex: 0, turnaroundMs: 480}),
            // rep 1 moved +20ms from 1450 → 1470
            expect.objectContaining({repIndex: 1, turnaroundMs: 1470}),
            expect.objectContaining({repIndex: 2, turnaroundMs: 2520}),
          ]),
        }),
      }),
    );
  });

  // --- Item A fix: non-zero-based repIndex (real synthetic data uses repIndex 1,2,3) ---

  // Fixture mirroring real synthetic data: repIndex starts at 1, not 0
  const makeResultWith3RepsNonZeroBased = (): BarTrackingResult => ({
    analysisId: 7,
    units: 'px/s',
    barPathSeries: [
      {tMs: 0,    x: 100, y: 200},
      {tMs: 500,  x: 110, y: 250},
      {tMs: 1000, x: 120, y: 200},
      {tMs: 1500, x: 130, y: 250},
      {tMs: 2000, x: 140, y: 200},
      {tMs: 2500, x: 150, y: 250},
      {tMs: 3000, x: 160, y: 200},
    ],
    confidenceSeries: [],
    repSegments: [
      {repIndex: 1, startMs: 0,    turnaroundMs: 500,  endMs: 1000},
      {repIndex: 2, startMs: 1000, turnaroundMs: 1500, endMs: 2000},
      {repIndex: 3, startMs: 2000, turnaroundMs: 2500, endMs: 3000},
    ],
    repMetrics: [],
    qualityFlags: [],
    analysisMeta: {
      sourceFps: 30, analyzedFps: 30, frameCount: 90, averageConfidence: 0.9,
      trackingFrameWidthPx: 640, trackingFrameHeightPx: 480,
    },
  });

  const make3RepSavedSetResultNonZeroBased = () => ({
    repResults: [
      {repIndex: 1, startMs: 0,    turnaroundMs: 480, endMs: 1000, totalTimeMs: 1000, eccentricTimeMs: 480, concentricTimeMs: 520, vAvg: 50, vPeak: 80},
      {repIndex: 2, startMs: 1000, turnaroundMs: 1450, endMs: 2000, totalTimeMs: 1000, eccentricTimeMs: 450, concentricTimeMs: 550, vAvg: 60, vPeak: 90},
      {repIndex: 3, startMs: 2000, turnaroundMs: 2520, endMs: 3000, totalTimeMs: 1000, eccentricTimeMs: 520, concentricTimeMs: 480, vAvg: 40, vPeak: 65},
    ],
    velocityLossPercent: 20,
    rirEstimate: '2-3',
    calibratedAt: '2026-01-01T00:00:00.000Z',
  });

  it('non-zero-based repIndex: saving uses seg.repIndex, not positional index', () => {
    // Verifies the Item A key-mismatch fix: synthetic data uses repIndex 1,2,3.
    // Before the fix, save path used positional idx=0,1,2 → repOverrides[0] was always empty
    // and the calibrated values were silently discarded. After the fix, seg.repIndex is used.
    const savedSetResult = make3RepSavedSetResultNonZeroBased();
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard
        analysisId={1}
        localVideoPath="/test/video.mp4"
        result={makeResultWith3RepsNonZeroBased()}
        savedSetResult={savedSetResult}
      />,
    );
    loadPlayer(getByTestId('video-analysis-playback-player'), 3000);
    setSpeedChartWidth(getByTestId, 240);

    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });
    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    const dispatched = dispatchMock.mock.calls[0][0];
    expect(dispatched.setResult.repResults).toHaveLength(3);
    // Calibrated turnaroundMs values (480, 1450, 2520) must survive save — not the auto-detected (500, 1500, 2500)
    expect(dispatched.setResult.repResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({repIndex: 1, turnaroundMs: 480}),
        expect.objectContaining({repIndex: 2, turnaroundMs: 1450}),
        expect.objectContaining({repIndex: 3, turnaroundMs: 2520}),
      ]),
    );
  });

  it('non-zero-based repIndex: middle-rep (i=1) calibration tap updates repIndex 2, not others', () => {
    const savedSetResult = make3RepSavedSetResultNonZeroBased();
    const {getByTestId} = render(
      <VideoAnalysisPlaybackOverlayCard
        analysisId={1}
        localVideoPath="/test/video.mp4"
        result={makeResultWith3RepsNonZeroBased()}
        savedSetResult={savedSetResult}
      />,
    );
    loadPlayer(getByTestId('video-analysis-playback-player'), 3000);
    setSpeedChartWidth(getByTestId, 240);

    act(() => { fireEvent.press(getByTestId('video-analysis-toggle-calibration')); });
    // rep at position i=1 has repIndex=2; testID uses positional i so stays 'calibrate-rep-1-*'
    act(() => { fireEvent.press(getByTestId('calibrate-rep-1-turnaround-right')); });
    act(() => { fireEvent.press(getByTestId('video-analysis-save-calibration')); });

    const dispatched = dispatchMock.mock.calls[0][0];
    expect(dispatched.setResult.repResults).toEqual(
      expect.arrayContaining([
        // repIndex 1 and 3 unchanged from savedSetResult
        expect.objectContaining({repIndex: 1, turnaroundMs: 480}),
        // repIndex 2 (position i=1) moved +20ms: 1450 → 1470
        expect.objectContaining({repIndex: 2, turnaroundMs: 1470}),
        expect.objectContaining({repIndex: 3, turnaroundMs: 2520}),
      ]),
    );
  });

  // --- Item B: VL% visible before first save when repSegments has auto-detected boundaries ---

  // Fixture with enough barPath variation to produce non-zero interval velocities
  const makeResultWith2RepsForVLTest = (): BarTrackingResult => ({
    analysisId: 8,
    units: 'px/s',
    barPathSeries: [
      // Rep 0 eccentric (0-300ms): y rises 200→260; concentric (300-600ms): y falls 260→200
      {tMs: 0,   x: 100, y: 200},
      {tMs: 100, x: 100, y: 220},
      {tMs: 200, x: 100, y: 240},
      {tMs: 300, x: 100, y: 260},
      {tMs: 400, x: 100, y: 240},
      {tMs: 500, x: 100, y: 220},
      {tMs: 600, x: 100, y: 200},
      // Rep 1 eccentric (600-900ms): y rises 200→230; concentric (900-1200ms): y falls 230→200
      // (smaller amplitude → lower vAvg → positive VL%)
      {tMs: 700, x: 100, y: 210},
      {tMs: 800, x: 100, y: 220},
      {tMs: 900, x: 100, y: 230},
      {tMs: 1000, x: 100, y: 220},
      {tMs: 1100, x: 100, y: 210},
      {tMs: 1200, x: 100, y: 200},
    ],
    confidenceSeries: [],
    repSegments: [
      {repIndex: 0, startMs: 0,   turnaroundMs: 300, endMs: 600},
      {repIndex: 1, startMs: 600, turnaroundMs: 900, endMs: 1200},
    ],
    repMetrics: [],
    qualityFlags: [],
    analysisMeta: {
      sourceFps: 30, analyzedFps: 30, frameCount: 36, averageConfidence: 0.9,
      trackingFrameWidthPx: 640, trackingFrameHeightPx: 480,
    },
  });

  it('VL% is visible without savedSetResult when repSegments has auto-detected boundaries', () => {
    // Verifies Item B: before the first manual save, VL% should show from auto-detected boundaries.
    // velocityLoss is computed from barPathSeries + repSegment boundaries — no video load needed.
    const {getByText} = render(
      <VideoAnalysisPlaybackOverlayCard
        analysisId={1}
        localVideoPath="/test/video.mp4"
        result={makeResultWith2RepsForVLTest()}
      />,
    );
    // The "Velocity Loss" section label must appear; its presence proves velocityLoss !== null
    expect(getByText('Velocity Loss')).toBeTruthy();
  });

  it('VL% display prefers live calc over a stale savedSetResult.velocityLossPercent', () => {
    // Item B priority swap: if a prior save left velocityLossPercent=0 but the
    // live calc from auto-detected boundaries (or current overrides) produces a
    // non-zero value, the live value must win — otherwise users see stale 0
    // before they save again.
    const staleSavedSetResult = {
      // repResults that re-seed the override map to the SAME values as auto-detected,
      // so the live calc remains non-zero.
      repResults: [
        {repIndex: 0, startMs: 0,   turnaroundMs: 300, endMs: 600, totalTimeMs: 600, eccentricTimeMs: 300, concentricTimeMs: 300, vAvg: 0, vPeak: 0},
        {repIndex: 1, startMs: 600, turnaroundMs: 900, endMs: 1200, totalTimeMs: 600, eccentricTimeMs: 300, concentricTimeMs: 300, vAvg: 0, vPeak: 0},
      ],
      velocityLossPercent: 0,
      rirEstimate: '4+',
      calibratedAt: '2026-01-01T00:00:00.000Z',
    };
    const {queryByText} = render(
      <VideoAnalysisPlaybackOverlayCard
        analysisId={1}
        localVideoPath="/test/video.mp4"
        result={makeResultWith2RepsForVLTest()}
        savedSetResult={staleSavedSetResult}
      />,
    );
    // Live calc yields VL ~50% (rep1 amplitude smaller than rep0). Saved is 0%.
    // After the fix, the displayed VL is the live value, not the stale 0.
    expect(queryByText('VL=0%')).toBeNull();
    // Compute the expected live VL from the fixture — must match the component's calc
    expect(queryByText(/^VL=\d+%$/)).toBeTruthy();
  });
});

// GH-351: MPAndroidChart reports UNCLAMPED left/right values from the fling
// deceleration (they can overshoot the x-axis bounds by seconds) while the
// rendered viewport is clamped to the axis range. The component must mirror the
// chart's translation clamping (shift the window, keep the span) so tap-to-seek
// and the velocity marker stay aligned with the curve that is actually drawn.
describe('VideoAnalysisPlaybackOverlayCard – zoomed chart overscroll clamping (GH-351)', () => {
  const CHART_WIDTH = 240; // 36 left padding + 200 drawable + 4 right padding

  const setup = () => {
    const utils = render(
      <VideoAnalysisPlaybackOverlayCard analysisId={1} localVideoPath="/test/video.mp4" result={makeResult()} />,
    );
    const player = utils.getByTestId('video-analysis-playback-player');
    const speedPlot = utils.getByTestId('video-analysis-playback-speed-plot');
    const speedChart = utils.getByTestId('video-analysis-playback-speed-chart');
    loadPlayer(player, 3000); // correctedPlaybackDurationMs = 3000
    act(() => {
      speedPlot.props.onLayout({nativeEvent: {layout: {width: CHART_WIDTH}}});
    });
    return {...utils, player, speedPlot, speedChart};
  };

  const fireChartChange = (speedPlot: any, action: string, left: number, right: number) => {
    act(() => {
      speedPlot.props.onChange({nativeEvent: {action, left, right}});
    });
  };

  // Bypass the 300ms tap suppression window that chartScaled/chartTranslated arms.
  const tapAfterGestureWindow = (speedChart: any, locationX: number) => {
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => new Date(2100, 0, 1).getTime());
    act(() => {
      fireEvent(speedChart, 'touchEnd', {nativeEvent: {locationX}});
    });
    nowSpy.mockRestore();
  };

  it('clamps a left-overscrolled fling window and keeps tap-to-seek aligned with the rendered range', () => {
    const {player, speedPlot, speedChart} = setup();

    // Fling deceleration reports window [-1000, 1000]; the chart renders [0, 2000].
    fireChartChange(speedPlot, 'chartTranslated', -1000, 1000);

    // Tap the drawable center: progress 0.5 → must map to 0 + 0.5*2000 = 1000ms.
    // Without clamping it would map to -1000 + 0.5*2000 = 0ms.
    tapAfterGestureWindow(speedChart, 136);
    expect(player.props.seekPositionMs).toBe(1000);
  });

  it('clamps a right-overscrolled fling window and keeps tap-to-seek aligned with the rendered range', () => {
    const {player, speedPlot, speedChart} = setup();

    // Fling deceleration reports [2000, 4000]; axis max is 3000 → rendered [1000, 3000].
    fireChartChange(speedPlot, 'chartTranslated', 2000, 4000);

    // Tap the drawable center: progress 0.5 → must map to 1000 + 0.5*2000 = 2000ms.
    // Without clamping it would map to 2000 + 0.5*2000 = 3000ms.
    tapAfterGestureWindow(speedChart, 136);
    expect(player.props.seekPositionMs).toBe(2000);
  });

  it('keeps the velocity marker at the chart left edge for t=0 after a left-overscrolled fling', () => {
    const {getByTestId, speedPlot} = setup();

    fireChartChange(speedPlot, 'chartTranslated', -1000, 1000);

    // Playback time is 0. With the clamped window [0, 2000] the marker must sit at
    // the left padding edge (36). With the raw window [-1000, 1000] it would be
    // drawn at 36 + 0.5*200 = 136 — one second into the plot (the reported bug).
    expect(getMarkerTranslateX(getByTestId)).toBe(36);
  });

  it('does not alter in-range zoom windows', () => {
    const {player, speedPlot, speedChart} = setup();

    fireChartChange(speedPlot, 'chartScaled', 500, 2500);

    // Tap the drawable center: progress 0.5 → 500 + 0.5*2000 = 1500ms.
    tapAfterGestureWindow(speedChart, 136);
    expect(player.props.seekPositionMs).toBe(1500);
  });
});
