import React from 'react';
import {act, render} from '@testing-library/react-native';
import VideoAnalysisTab from '../../../app/tabs/Analyse/VideoAnalysisTab';
import {VideoAnalysis, VideoAnalysisStatus} from '../../../app/models/entities/VideoAnalysis';
import {useAllVideoAnalyses} from '../../../app/redux/VideoAnalysis/use/useAllVideoAnalyses';

// GH-343: the running-import progress bar froze at 2-4% because the ticking
// `now` state only reached FlashList rows while store-driven `data` changes
// happened to re-render them. FlashList cells are pure — they ignore
// renderItem identity changes and only re-render when `data` or `extraData`
// change. The mock below mirrors that contract exactly so these tests fail
// if the `extraData` wiring is removed again.
jest.mock('@shopify/flash-list', () => {
  const ReactLocal = require('react');
  const {View} = require('react-native');

  const PureCell: any = class extends ReactLocal.Component {
    shouldComponentUpdate(nextProps: any) {
      return nextProps.data !== this.props.data || nextProps.extraData !== this.props.extraData;
    }
    render() {
      const {renderItem, item, index} = this.props as any;
      return renderItem({item, index});
    }
  };

  return {
    FlashList: ({data, renderItem, extraData, keyExtractor}: any) => (
      <View testID="flash-list">
        {data.map((item: any, index: number) => (
          <PureCell
            key={keyExtractor ? keyExtractor(item, index) : index}
            data={data}
            extraData={extraData}
            item={item}
            index={index}
            renderItem={renderItem}
          />
        ))}
      </View>
    ),
  };
});

jest.mock('../../../app/redux/VideoAnalysis/use/useAllVideoAnalyses', () => ({
  useAllVideoAnalyses: jest.fn(() => []),
}));
jest.mock('../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: jest.fn(() => []),
}));

jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis', () => ({dispatchAddVideoAnalysis: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchDeleteVideoAnalysis', () => ({dispatchDeleteVideoAnalysis: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult', () => ({dispatchAttachVideoAnalysisResult: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath', () => ({dispatchSetVideoAnalysisManualSeedFramePath: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel', () => ({dispatchSetVideoAnalysisMetersPerPixel: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisSeedPreflight', () => ({dispatchSetVideoAnalysisSeedPreflight: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisDuration', () => ({dispatchSetVideoAnalysisDuration: () => jest.fn()}));
jest.mock('../../../app/redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus', () => ({dispatchSetVideoAnalysisStatus: () => jest.fn()}));
jest.mock('../../../app/redux/settings/dispatch/dispatchSetVideoAnalysisFiltersExpanded', () => ({dispatchSetVideoAnalysisFiltersExpanded: () => jest.fn()}));
jest.mock('../../../app/redux/settings/dispatch/dispatchSetVideoAnalysisLearnedRate', () => ({dispatchSetVideoAnalysisLearnedRate: () => jest.fn()}));

const mockState = {
  settings: {
    videoAnalysisFiltersExpanded: false,
    videoAnalysisLearnedRateSecondsPerVideoSecond: 1,
    toggles: {},
  },
  workouts: {byId: {}},
};

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: any) => any) => selector(mockState),
  useStore: () => ({getState: () => mockState}),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}));

jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: {
    pickSingle: jest.fn(),
    isCancel: () => false,
    types: {video: 'video/*'},
  },
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {show: jest.fn()},
}));

jest.mock('../../../app/utils/video-analysis-import', () => ({
  importVideoAnalysisFromSource: jest.fn(),
}));

jest.mock('../../../app/utils/videoAnalysisStorage', () => ({
  deleteVideoAnalysisArtifacts: jest.fn(),
  getVideoAnalysisPreviewPath: jest.fn(() => '/tmp/preview.png'),
}));

// Real module pulls in notifee; the estimate itself is video duration × rate.
jest.mock('../../../app/utils/videoAnalysisNotification', () => ({
  estimateAnalysisTimeMs: (videoDurationMs: number, rate: number = 1) => videoDurationMs * rate,
}));

jest.mock('../../../app/components/video/SetSelectionModal', () => {
  const {View} = require('react-native');
  return () => <View testID="set-selection-modal" />;
});

jest.mock('../../../app/components/video/VideoAnalysisFiltersSection', () => {
  const {View} = require('react-native');
  return () => <View testID="filters-section" />;
});

// The row stub surfaces exactly what the ticket is about: the progress /
// elapsed values that actually reach a rendered list row.
jest.mock('../../../app/components/video/VideoAnalysisListItem', () => {
  const {Text} = require('react-native');
  return ({analysis, progress, elapsedMs}: any) => (
    <Text testID={`row-progress-${analysis.id}`}>
      {progress === undefined ? 'no-progress' : `${Math.round(progress * 100)}%|${elapsedMs}ms`}
    </Text>
  );
});

jest.mock('react-native-paper', () => {
  const ReactLocal = require('react');
  const {Text, View, TextInput} = require('react-native');
  const Card = ({children, ...props}: any) => <View {...props}>{children}</View>;
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Text: ({children, ...props}: any) => <Text {...props}>{children}</Text>,
    Button: ({children, ...props}: any) => <View {...props}>{children}</View>,
    Card,
    Searchbar: (props: any) => <TextInput {...props} />,
    useTheme: () => ({colors: {background: '#fff'}}),
  };
});

const mockUseAllVideoAnalyses = jest.mocked(useAllVideoAnalyses);

const T0 = new Date('2026-07-06T10:00:00.000Z');

const buildAnalysis = (overrides: Partial<VideoAnalysis>): VideoAnalysis =>
  ({
    id: 1,
    status: VideoAnalysisStatus.QUEUED,
    createdAt: T0.toISOString(),
    videoMeta: {durationMs: 30000, fps: 30, width: 720, height: 1280},
    ...overrides,
  } as VideoAnalysis);

describe('VideoAnalysisTab — running import progress (GH-343)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('keeps advancing the row progress while the analysis is active, without any store update', () => {
    // One stable array reference for the whole test — exactly like a real
    // running import, where the store does not change between status writes.
    const analyses = [buildAnalysis({})];
    mockUseAllVideoAnalyses.mockReturnValue(analyses);

    const {getByTestId} = render(<VideoAnalysisTab />);
    expect(getByTestId('row-progress-1').props.children).toBe('0%|0ms');

    // 30s video at 1s/s rate → 30s estimate. After 3s the bar must be at 10%.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(getByTestId('row-progress-1').props.children).toBe('10%|3000ms');

    // ...and it must KEEP moving well past the 2-4% freeze from the ticket.
    act(() => {
      jest.advanceTimersByTime(12000);
    });
    expect(getByTestId('row-progress-1').props.children).toBe('50%|15000ms');
  });

  it('caps the reported progress below 100% until the analysis is confirmed done', () => {
    const analyses = [buildAnalysis({})];
    mockUseAllVideoAnalyses.mockReturnValue(analyses);

    const {getByTestId} = render(<VideoAnalysisTab />);
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(getByTestId('row-progress-1').props.children).toBe('95%|60000ms');
  });

  it('renders no progress bar for a DONE analysis', () => {
    const analyses = [buildAnalysis({status: VideoAnalysisStatus.DONE})];
    mockUseAllVideoAnalyses.mockReturnValue(analyses);

    const {getByTestId} = render(<VideoAnalysisTab />);
    expect(getByTestId('row-progress-1').props.children).toBe('no-progress');
  });
});
