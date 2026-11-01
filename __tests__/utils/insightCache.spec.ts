import {insightCache, formatGeneratedAt, CachedInsight} from '../../app/utils/insightCache';

// react-native-mmkv is globally mocked in jest.setup.js — we need a fresh
// instance per test. Grab the underlying mock factory so we can control storage.
let mockStore: Record<string, string> = {};

// Override the MMKV mock to use a per-test in-memory store so tests are isolated.
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn((k: string) => mockStore[k]),
    set: jest.fn((k: string, v: string) => {
      mockStore[k] = v;
    }),
    remove: jest.fn((k: string) => {
      delete mockStore[k];
    }),
    contains: jest.fn((k: string) => k in mockStore),
  })),
}));

beforeEach(() => {
  mockStore = {};
});

// Re-import after mocking so insightCache picks up the fresh mock
// (jest.mock is hoisted, so the above mock applies to the module under test)

describe('insightCache', () => {
  const KEY = 'test-key';
  const FULL_KEY = `insight_${KEY}`;

  describe('set / get round-trip', () => {
    it('stores and retrieves a CachedInsight', () => {
      const insight: CachedInsight = {text: 'Great work!', generatedAt: 1000};
      insightCache.set(KEY, insight);
      expect(mockStore[FULL_KEY]).toBe(JSON.stringify(insight));
      const result = insightCache.get(KEY);
      expect(result).toEqual(insight);
    });
  });

  describe('get — migration from old plain-string format', () => {
    it('returns undefined for a plain string (old format) and does not crash', () => {
      // Simulate an old cache entry that is just a plain string, not JSON
      mockStore[FULL_KEY] = 'Old plain text insight';
      expect(insightCache.get(KEY)).toBeUndefined();
    });

    it('returns undefined for JSON that lacks required fields', () => {
      mockStore[FULL_KEY] = JSON.stringify({foo: 'bar'});
      expect(insightCache.get(KEY)).toBeUndefined();
    });

    it('returns undefined when nothing is stored', () => {
      expect(insightCache.get(KEY)).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('removes the entry from the store', () => {
      const insight: CachedInsight = {text: 'Test', generatedAt: 2000};
      insightCache.set(KEY, insight);
      expect(insightCache.get(KEY)).toBeDefined();

      insightCache.delete(KEY);
      expect(mockStore[FULL_KEY]).toBeUndefined();
      expect(insightCache.get(KEY)).toBeUndefined();
    });
  });
});

describe('formatGeneratedAt', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "Generated just now" for less than 1 minute ago', () => {
    expect(formatGeneratedAt(NOW - 30_000)).toBe('Generated just now');
  });

  it('returns minutes when less than 1 hour ago', () => {
    expect(formatGeneratedAt(NOW - 5 * 60_000)).toBe('Generated 5m ago');
  });

  it('returns hours when less than 1 day ago', () => {
    expect(formatGeneratedAt(NOW - 2 * 3_600_000)).toBe('Generated 2h ago');
  });

  it('returns days for older entries', () => {
    expect(formatGeneratedAt(NOW - 3 * 86_400_000)).toBe('Generated 3d ago');
  });
});
