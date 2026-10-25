import {useCallback} from 'react';
import {useBodyWeights} from './useHealthConnect';
import {relativeStrength, weightAt} from '../../../utils/healthConnect/bodyWeight';

/**
 * GH-528 (T3): returns a function computing 1RM / body weight at the time the 1RM was set.
 * Without body weights from Health Connect it always returns undefined, so callers render
 * exactly what they rendered before.
 */
export const useRelativeStrength = () => {
  const weights = useBodyWeights();
  return useCallback(
    (oneRmKg: number | undefined, at: Date | string | number | undefined): number | undefined => {
      if (weights.length === 0 || at === undefined) return undefined;
      const time = new Date(at).getTime();
      return Number.isFinite(time) ? relativeStrength(oneRmKg, weightAt(weights, time)?.kg) : undefined;
    },
    [weights],
  );
};
