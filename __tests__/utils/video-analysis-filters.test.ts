import {Range} from '../../app/components/picker/date/DateRangePicker';
import {VideoAnalysis, VideoAnalysisStatus} from '../../app/models/entities/VideoAnalysis';
import {buildVideoAnalysisDefaultDateRange, filterVideoAnalyses, isSameRange, matchesRirPreset, matchesVlPreset} from '../../app/utils/video-analysis-filters';

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

  describe('date boundary normalization', () => {
    it('includes an analysis created at the end of the end-date day (23:59:59)', () => {
      // Analysis at LOCAL 23:59:59 on April 2.
      // DateRangePicker delivers date-only values (midnight). endDate = April 2 at midnight.
      // filterVideoAnalyses must normalize endDate to end-of-day so the analysis is included.
      const lateAnalysis = createAnalysis({id: 1, createdAt: new Date(2026, 3, 2, 23, 59, 59, 999)});
      const analyses = [lateAnalysis];

      expect(
        filterVideoAnalyses({
          analyses,
          exerciseIds: [],
          hasMuscleFilter: false,
          muscleExerciseIds: [],
          // endDate is April 2 midnight (as the picker would provide)
          dateRange: new Range(new Date(2026, 3, 1, 0, 0, 0, 0), new Date(2026, 3, 2, 0, 0, 0, 0)),
          isDateRangeFilterActive: true,
          vlPresets: [],
          rirPresets: [],
        }),
      ).toEqual([lateAnalysis]);
    });

    it('includes an analysis created at the start of the start-date day (00:00:01)', () => {
      // Analysis at LOCAL 00:00:01 on April 1.
      // startDate may arrive as non-midnight (e.g. 06:00) from state.
      // filterVideoAnalyses must normalize startDate to start-of-day so the analysis is included.
      const earlyAnalysis = createAnalysis({id: 1, createdAt: new Date(2026, 3, 1, 0, 0, 1, 0)});
      const analyses = [earlyAnalysis];

      expect(
        filterVideoAnalyses({
          analyses,
          exerciseIds: [],
          hasMuscleFilter: false,
          muscleExerciseIds: [],
          // startDate at 06:00 local — still the same calendar day
          dateRange: new Range(new Date(2026, 3, 1, 6, 0, 0, 0), new Date(2026, 3, 3, 0, 0, 0, 0)),
          isDateRangeFilterActive: true,
          vlPresets: [],
          rirPresets: [],
        }),
      ).toEqual([earlyAnalysis]);
    });

    it('excludes an analysis strictly before the start date', () => {
      const analysis = createAnalysis({id: 1, createdAt: new Date(2026, 2, 31, 23, 59, 59, 999)});

      expect(
        filterVideoAnalyses({
          analyses: [analysis],
          exerciseIds: [],
          hasMuscleFilter: false,
          muscleExerciseIds: [],
          dateRange: new Range(new Date(2026, 3, 1, 0, 0, 0, 0), new Date(2026, 3, 3, 0, 0, 0, 0)),
          isDateRangeFilterActive: true,
          vlPresets: [],
          rirPresets: [],
        }),
      ).toEqual([]);
    });
  });

  describe('matchesVlPreset', () => {
    it('maps VL=29 to 20-30% and not >30%', () => {
      expect(matchesVlPreset(29, '20-30%')).toEqual(true);
      expect(matchesVlPreset(29, '>30%')).toEqual(false);
    });

    it('maps VL=30 to 20-30% (inclusive upper bound) and not >30%', () => {
      expect(matchesVlPreset(30, '20-30%')).toEqual(true);
      expect(matchesVlPreset(30, '>30%')).toEqual(false);
    });

    it('maps VL=31 to >30% (strict) and not 20-30%', () => {
      expect(matchesVlPreset(31, '>30%')).toEqual(true);
      expect(matchesVlPreset(31, '20-30%')).toEqual(false);
    });

    it('maps VL=null to false for all presets', () => {
      expect(matchesVlPreset(null, '<10%')).toEqual(false);
      expect(matchesVlPreset(null, '20-30%')).toEqual(false);
      expect(matchesVlPreset(null, '>30%')).toEqual(false);
    });

    it('maps VL=9 to <10% only', () => {
      expect(matchesVlPreset(9, '<10%')).toEqual(true);
      expect(matchesVlPreset(9, '10-20%')).toEqual(false);
    });

    it('maps VL=10 to 10-20% and not <10%', () => {
      expect(matchesVlPreset(10, '<10%')).toEqual(false);
      expect(matchesVlPreset(10, '10-20%')).toEqual(true);
    });
  });

  describe('matchesRirPreset — range-style estimates', () => {
    it('matches lower bound of range', () => {
      expect(matchesRirPreset('0-1', '0')).toEqual(true);
      expect(matchesRirPreset('2-3', '2')).toEqual(true);
      expect(matchesRirPreset('3-4', '3')).toEqual(true);
    });

    it('matches upper bound of range', () => {
      expect(matchesRirPreset('0-1', '1')).toEqual(true);
      expect(matchesRirPreset('1-2', '2')).toEqual(true);
      expect(matchesRirPreset('2-3', '3')).toEqual(true);
      expect(matchesRirPreset('3-4', '4')).toEqual(true);
    });

    it('does not match chip outside range', () => {
      expect(matchesRirPreset('0-1', '2')).toEqual(false);
      expect(matchesRirPreset('2-3', '4')).toEqual(false);
    });
  });

  describe('matchesRirPreset — single-value and 4+ estimates', () => {
    it('matches exact single-value estimates', () => {
      expect(matchesRirPreset('4', '4')).toEqual(true);
      expect(matchesRirPreset('0', '0')).toEqual(true);
    });

    it('matches 4+ chip for values >= 4', () => {
      expect(matchesRirPreset('5', '4+')).toEqual(true);
      expect(matchesRirPreset('4+', '4+')).toEqual(true);
    });

    it('does not match 4 chip to 4+ estimate', () => {
      expect(matchesRirPreset('4+', '4')).toEqual(false);
    });

    it('returns false for null or empty rirStr', () => {
      expect(matchesRirPreset(null, '0')).toEqual(false);
      expect(matchesRirPreset('', '0')).toEqual(false);
    });
  });
});
