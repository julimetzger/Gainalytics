import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';

/** Stable order for the editor list (alphabetical by display name). */
export const ALL_MUSCLES_SORTED = [...(Object.values(Muscles) as Muscles[])].sort((a, b) => a.localeCompare(b));

export function pairsToDraft(pairs: MusclePercentPair[]): Record<Muscles, string> {
  const out = {} as Record<Muscles, string>;
  for (const m of ALL_MUSCLES_SORTED) {
    const pair = pairs.find((p) => p.muscle === m);
    const p = pair?.percent;
    out[m] = p !== undefined && !Number.isNaN(Number(p)) ? String(p) : '0';
  }
  return out;
}

export function draftToPairs(draft: Record<Muscles, string>): MusclePercentPair[] {
  const result: MusclePercentPair[] = [];
  for (const m of ALL_MUSCLES_SORTED) {
    const raw = draft[m]?.trim() ?? '';
    const n = parseInt(raw, 10);
    const percent = Number.isNaN(n) ? 0 : n;
    if (percent > 0) {
      result.push({muscle: m, percent});
    }
  }
  return result;
}
