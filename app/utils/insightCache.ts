/**
 * Cache for coach insights, keyed by training ID.
 * Stored in a plain MMKV instance (insight text is not sensitive).
 */
import {createMMKV} from 'react-native-mmkv';

const cache = createMMKV({id: 'insight-cache'});

const key = (cacheKey: string | number) => `insight_${cacheKey}`;

export interface CachedInsight {
  text: string;
  generatedAt: number; // Unix ms
  /** GH-449: true when the model hit its token cap, so the card can say the advice is short. */
  truncated?: boolean;
}

/**
 * Returns a human-readable relative timestamp string.
 * e.g. "Generated just now", "Generated 2h ago", "Generated 3d ago"
 */
export function formatGeneratedAt(generatedAt: number): string {
  const diffMs = Date.now() - generatedAt;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'Generated just now';
  if (diffMin < 60) return `Generated ${diffMin}m ago`;
  if (diffHours < 24) return `Generated ${diffHours}h ago`;
  return `Generated ${diffDays}d ago`;
}

export const insightCache = {
  get(cacheKey: string | number): CachedInsight | undefined {
    const raw = cache.getString(key(cacheKey));
    if (!raw) return undefined;

    // Migration: old entries were stored as plain strings, not JSON objects.
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'text' in (parsed as object) &&
        'generatedAt' in (parsed as object)
      ) {
        return parsed as CachedInsight;
      }
      // Parsed but not the expected shape — treat as missing.
      return undefined;
    } catch {
      // Not JSON → old plain-string format. Treat as missing (no timestamp available).
      return undefined;
    }
  },

  set(cacheKey: string | number, insight: CachedInsight): void {
    cache.set(key(cacheKey), JSON.stringify(insight));
  },

  delete(cacheKey: string | number): void {
    cache.remove(key(cacheKey));
  },

  has(cacheKey: string | number): boolean {
    return cache.contains(key(cacheKey));
  },
};
