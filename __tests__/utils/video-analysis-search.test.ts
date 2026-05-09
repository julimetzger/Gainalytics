import {VideoAnalysis, VideoAnalysisStatus} from '../../app/models/entities/VideoAnalysis';
import {filterVideoAnalysesBySearchQuery} from '../../app/utils/video-analysis-filters';

const VIDEO_META = {durationMs: 1000, fps: 30, width: 1920, height: 1080};

function makeAnalysis(overrides: Partial<VideoAnalysis>): VideoAnalysis {
  return {
    id: 1,
    sourceUri: 'file://test.mp4',
    createdAt: new Date('2026-04-01T12:00:00.000Z'),
    status: VideoAnalysisStatus.DONE,
    videoMeta: VIDEO_META,
    ...overrides,
  };
}

const noRir = (_w: number, _s: number): number | null => null;

describe('filterVideoAnalysesBySearchQuery', () => {
  describe('empty query', () => {
    it('returns full list for empty string', () => {
      const analyses = [makeAnalysis({id: 1}), makeAnalysis({id: 2})];
      expect(filterVideoAnalysesBySearchQuery(analyses, '', () => 'Squat', noRir)).toEqual(analyses);
    });

    it('returns full list for whitespace-only query', () => {
      const analyses = [makeAnalysis({id: 1})];
      expect(filterVideoAnalysesBySearchQuery(analyses, '   ', () => 'Squat', noRir)).toEqual(analyses);
    });
  });

  describe('numeric token — RIR filtering', () => {
    it('keeps analyses whose linked set RIR matches the token', () => {
      const match = makeAnalysis({id: 1, workoutId: 10, setIndex: 0});
      const noMatch = makeAnalysis({id: 2, workoutId: 10, setIndex: 1});
      const getSetRir = (_w: number, s: number): number | null => (s === 0 ? 1 : 2);
      const result = filterVideoAnalysesBySearchQuery([match, noMatch], '1', () => undefined, getSetRir);
      expect(result).toEqual([match]);
    });

    it('excludes analyses with no linked workout when querying by RIR', () => {
      const unlinked = makeAnalysis({id: 1, workoutId: undefined, setIndex: undefined});
      const result = filterVideoAnalysesBySearchQuery([unlinked], '0', () => undefined, noRir);
      expect(result).toEqual([]);
    });

    it('handles RIR 0', () => {
      const rir0 = makeAnalysis({id: 1, workoutId: 10, setIndex: 0});
      const rir1 = makeAnalysis({id: 2, workoutId: 10, setIndex: 1});
      const getSetRir = (_w: number, s: number): number | null => (s === 0 ? 0 : 1);
      expect(filterVideoAnalysesBySearchQuery([rir0, rir1], '0', () => undefined, getSetRir)).toEqual([rir0]);
    });
  });

  describe('string token — exercise name filtering', () => {
    it('keeps analyses whose exercise name contains the token (case-insensitive)', () => {
      const bench = makeAnalysis({id: 1, exerciseId: 10});
      const squat = makeAnalysis({id: 2, exerciseId: 20});
      const getName = (a: VideoAnalysis) => (a.exerciseId === 10 ? 'Bankdrücken' : 'Kniebeuge');
      expect(filterVideoAnalysesBySearchQuery([bench, squat], 'bank', getName, noRir)).toEqual([bench]);
    });

    it('is case-insensitive', () => {
      const bench = makeAnalysis({id: 1, exerciseId: 10});
      const getName = (a: VideoAnalysis) => (a.exerciseId === 10 ? 'Bankrücken' : undefined);
      expect(filterVideoAnalysesBySearchQuery([bench], 'Bank', getName, noRir)).toEqual([bench]);
      expect(filterVideoAnalysesBySearchQuery([bench], 'BANK', getName, noRir)).toEqual([bench]);
      expect(filterVideoAnalysesBySearchQuery([bench], 'bankrücken', getName, noRir)).toEqual([bench]);
    });

    it('excludes analyses whose exercise name does not contain the token', () => {
      const squat = makeAnalysis({id: 1, exerciseId: 20});
      const getName = (a: VideoAnalysis) => (a.exerciseId === 20 ? 'Kniebeuge' : undefined);
      expect(filterVideoAnalysesBySearchQuery([squat], 'Bank', getName, noRir)).toEqual([]);
    });

    it('excludes analyses with no resolved exercise name', () => {
      const unresolved = makeAnalysis({id: 1, exerciseId: undefined});
      expect(filterVideoAnalysesBySearchQuery([unresolved], 'squat', () => undefined, noRir)).toEqual([]);
    });
  });

  describe('combined tokens — AND semantics', () => {
    it('requires all tokens to match (exercise name AND RIR)', () => {
      const analyses = [
        makeAnalysis({id: 1, exerciseId: 10, workoutId: 100, setIndex: 0}), // Bank + RIR 1 → match
        makeAnalysis({id: 2, exerciseId: 10, workoutId: 100, setIndex: 1}), // Bank + RIR 2 → no match
        makeAnalysis({id: 3, exerciseId: 20, workoutId: 100, setIndex: 0}), // Squat + RIR 1 → no match
      ];
      const getName = (a: VideoAnalysis) => (a.exerciseId === 10 ? 'Bankrücken' : 'Kniebeuge');
      const getSetRir = (_w: number, s: number): number | null => (s === 0 ? 1 : 2);
      expect(filterVideoAnalysesBySearchQuery(analyses, 'Bank 1', getName, getSetRir)).toEqual([analyses[0]]);
    });

    it('handles multiple string tokens with AND semantics', () => {
      const a = makeAnalysis({id: 1, exerciseId: 10});
      const b = makeAnalysis({id: 2, exerciseId: 20});
      // "Bank rück" → "rück" only matches 'Bankrücken', not 'Bankpresse'
      const getName = (analysis: VideoAnalysis) => (analysis.exerciseId === 10 ? 'Bankrücken' : 'Bankpresse');
      expect(filterVideoAnalysesBySearchQuery([a, b], 'Bank rück', getName, noRir)).toEqual([a]);
    });
  });
});
