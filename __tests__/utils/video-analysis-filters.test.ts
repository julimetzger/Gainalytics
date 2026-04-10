import {Range} from '../../app/components/picker/date/DateRangePicker';
import {VideoAnalysis, VideoAnalysisStatus} from '../../app/models/entities/VideoAnalysis';
import {buildVideoAnalysisDefaultDateRange, filterVideoAnalyses, isSameRange, matchesRirPreset} from '../../app/utils/video-analysis-filters';

const VIDEO_META = {
  durationMs: 1000,
  fps: 30,
  width: 1920,
  height: 1080,
};

function createAnalysis(overrides: Partial<VideoAnalysis>): VideoAnalysis {
  return {
    id: 1,
    sourceUri: 'file://analysis.mp4',
    createdAt: new Date('2026-04-01T12:00:00.000Z'),
    status: VideoAnalysisStatus.DONE,
    videoMeta: VIDEO_META,
    ...overrides,
  };
}

describe('video-analysis-filters', () => {
  it('returns all analyses when no filter is active', () => {
    const analyses = [
      createAnalysis({id: 1, exerciseId: 11, createdAt: new Date('2026-03-01T10:00:00.000Z')}),
      createAnalysis({id: 2, exerciseId: 22, createdAt: new Date('2026-04-02T08:00:00.000Z')}),
    ];
    const dateRange = buildVideoAnalysisDefaultDateRange(analyses);

    expect(
      filterVideoAnalyses({
        analyses,
        exerciseIds: [],
        hasMuscleFilter: false,
        muscleExerciseIds: [],
        dateRange,
        isDateRangeFilterActive: false,
        vlPresets: [],
        rirPresets: [],
      }),
    ).toEqual(analyses);
  });

  it('builds an all-analyses default range and recognizes it as inactive', () => {
    const analyses = [createAnalysis({id: 1, createdAt: new Date('2026-03-01T10:00:00.000Z')}), createAnalysis({id: 2, createdAt: new Date('2026-04-02T08:00:00.000Z')})];
    const expectedRange = new Range(new Date(2026, 2, 1), new Date(2026, 3, 2));

    expect(buildVideoAnalysisDefaultDateRange(analyses)).toEqual(expectedRange);
    expect(isSameRange(buildVideoAnalysisDefaultDateRange(analyses), expectedRange)).toEqual(true);
  });

  it('AND-combines exercise, muscle, date, velocity loss, and rir filters', () => {
    const matchingAnalysis = createAnalysis({
      id: 1,
      exerciseId: 11,
      createdAt: new Date(2026, 3, 2, 12),
      setResult: {
        repResults: [],
        velocityLossPercent: 5,
        rirEstimate: '0-1',
      },
    });
    const analyses = [
      matchingAnalysis,
      createAnalysis({
        id: 2,
        exerciseId: 22,
        createdAt: new Date(2026, 3, 2, 12),
        setResult: {
          repResults: [],
          velocityLossPercent: 5,
          rirEstimate: '0-1',
        },
      }),
      createAnalysis({
        id: 3,
        exerciseId: 11,
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        setResult: {
          repResults: [],
          velocityLossPercent: 25,
          rirEstimate: '2-3',
        },
      }),
    ];

    expect(
      filterVideoAnalyses({
        analyses,
        exerciseIds: [11],
        hasMuscleFilter: true,
        muscleExerciseIds: [11, 33],
        dateRange: new Range(new Date(2026, 3, 1), new Date(2026, 3, 3)),
        isDateRangeFilterActive: true,
        vlPresets: ['<10%'],
        rirPresets: ['0'],
      }),
    ).toEqual([matchingAnalysis]);
  });

  it('matches analyses through muscle-to-exercise mapping', () => {
    const analyses = [createAnalysis({id: 1, exerciseId: 11}), createAnalysis({id: 2, exerciseId: 22})];

    expect(
      filterVideoAnalyses({
        analyses,
        exerciseIds: [],
        hasMuscleFilter: true,
        muscleExerciseIds: [22],
        dateRange: buildVideoAnalysisDefaultDateRange(analyses),
        isDateRangeFilterActive: false,
        vlPresets: [],
        rirPresets: [],
      }),
    ).toEqual([createAnalysis({id: 2, exerciseId: 22})]);
  });

  it('matches exact RIR chips for range-style and exact values', () => {
    expect(matchesRirPreset('0-1', '0')).toEqual(true);
    expect(matchesRirPreset('2-3', '2')).toEqual(true);
    expect(matchesRirPreset('4', '4')).toEqual(true);
    expect(matchesRirPreset('5', '4+')).toEqual(true);
    expect(matchesRirPreset('4+', '4+')).toEqual(true);
    expect(matchesRirPreset('4+', '4')).toEqual(false);
    expect(matchesRirPreset('2-3', '3')).toEqual(false);
  });
});
