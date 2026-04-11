/**
 * Cache for coach insights, keyed by training ID.
 * Stored in a plain MMKV instance (insight text is not sensitive).
 */
import {MMKV} from 'react-native-mmkv';

const cache = new MMKV({id: 'insight-cache'});

const key = (cacheKey: string | number) => `insight_${cacheKey}`;

export const insightCache = {
  get(cacheKey: string | number): string | undefined {
    return cache.getString(key(cacheKey));
  },
  set(cacheKey: string | number, insight: string): void {
    cache.set(key(cacheKey), insight);
  },
  has(cacheKey: string | number): boolean {
    return cache.contains(key(cacheKey));
  },
};
