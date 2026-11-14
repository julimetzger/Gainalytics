import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {makeMutable} from 'react-native-reanimated';
import VideoAnalysisPlaybackOverlayCard from '../../../app/components/video/VideoAnalysisPlaybackOverlayCard';
import CompareSyncPlaybackCard from '../../../app/components/video/CompareSyncPlaybackCard';
import {BarTrackingResult} from '../../../app/models/entities/VideoAnalysis';

// GH-695: the screens stay mounted when the user switches tabs, so playback
// has to stop when the screen loses focus. Like the real `useIsFocused`, the
// mock re-renders its subscribers on focus/blur (the cards are memo()ised, so a
// plain rerender would not re-read a changed return value).
const mockFocus = {focused: true, listeners: new Set<() => void>()};
jest.mock('@react-navigation/native', () => {
  const ReactActual = jest.requireActual('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useIsFocused: () =>
      ReactActual.useSyncExternalStore(
        (listener: () => void) => {
          mockFocus.listeners.add(listener);
          return () => mockFocus.listeners.delete(listener);
        },
        () => mockFocus.focused,
      ),
  };
});

const setFocused = (focused: boolean) => {
  act(() => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
};

jest.mock('react-native-charts-wrapper', () => ({
  LineChart: 'LineChart',
}));

jest.mock('../../../app/utils/videoAnalysisNative', () => ({
  isVideoSourceAvailable: jest.fn().mockResolvedValue(true),
}));

const makeResult = (): BarTrackingResult => ({
  analysisId: 1,
  units: 'px/s',
  barPathSeries: [
    {tMs: 0, x: 100, y: 200},
    {tMs: 1000, x: 120, y: 220},
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

beforeEach(() => {
  mockFocus.focused = true;
});

describe('GH-695 – VideoAnalysisPlaybackOverlayCard pauses when its screen loses focus', () => {
  const renderCard = async () => {
    const utils = render(<VideoAnalysisPlaybackOverlayCard analysisId={1} videoUri="/test/video.mp4" result={makeResult()} />);
    // Let the async source-availability probe settle so the player renders.
    await act(async () => {});
    return utils;
  };

  const playbackState = (getByTestId: (id: string) => any) => ({
    paused: getByTestId('video-analysis-playback-player').props.paused,
    toggleLabel: getByTestId('video-analysis-playback-toggle').props.accessibilityLabel,
  });

  it('stops a running playback when the tab is left', async () => {
    const {getByTestId} = await renderCard();
    fireEvent.press(getByTestId('video-analysis-playback-toggle'));
    expect(playbackState(getByTestId)).toEqual({paused: false, toggleLabel: 'Pause'});

    setFocused(false);

    expect(playbackState(getByTestId)).toEqual({paused: true, toggleLabel: 'Play'});
  });

  it('stays paused when the user comes back to the tab', async () => {
    const {getByTestId} = await renderCard();
    fireEvent.press(getByTestId('video-analysis-playback-toggle'));
    setFocused(false);
    setFocused(true);

    expect(playbackState(getByTestId)).toEqual({paused: true, toggleLabel: 'Play'});
  });

  it('can be started again after returning', async () => {
    const {getByTestId} = await renderCard();
    fireEvent.press(getByTestId('video-analysis-playback-toggle'));
    setFocused(false);
    setFocused(true);
    fireEvent.press(getByTestId('video-analysis-playback-toggle'));

    expect(playbackState(getByTestId)).toEqual({paused: false, toggleLabel: 'Pause'});
  });

  it('leaves an already paused player untouched when the tab is left', async () => {
    const {getByTestId} = await renderCard();
    setFocused(false);

    expect(playbackState(getByTestId)).toEqual({paused: true, toggleLabel: 'Play'});
  });
});

describe('GH-695 – CompareSyncPlaybackCard pauses both videos when its screen loses focus', () => {
  const renderCard = () =>
    render(
      <CompareSyncPlaybackCard
        videoPathA="/test/a.mp4"
        videoPathB="/test/b.mp4"
        resultA={makeResult()}
        resultB={makeResult()}
        offsetBMs={0}
        autoOffsetMs={0}
        syncMode="auto"
        onSyncModeChange={jest.fn()}
        onManualOffsetChange={jest.fn()}
        timelineTimeSV={makeMutable(0)}
      />,
    );

  const playbackState = (getByTestId: (id: string) => any) => ({
    pausedA: getByTestId('compare-video-a').props.children[0].props.paused,
    pausedB: getByTestId('compare-video-b').props.children[0].props.paused,
    toggleLabel: getByTestId('compare-play-pause-button').props.accessibilityLabel,
  });

  it('stops both players when the tab is left', () => {
    const {getByTestId} = renderCard();
    fireEvent.press(getByTestId('compare-play-pause-button'));
    expect(playbackState(getByTestId)).toEqual({pausedA: false, pausedB: false, toggleLabel: 'Pause'});

    setFocused(false);

    expect(playbackState(getByTestId)).toEqual({pausedA: true, pausedB: true, toggleLabel: 'Play'});
  });
});
