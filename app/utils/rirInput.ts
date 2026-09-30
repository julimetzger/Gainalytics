import {ensureFormat} from './numberInput';

export const RIR_MIN = 0;
export const RIR_MAX = 10;

/** GH-466: RIR may carry decimals (1.5) — the rule the user sees when an entry is rejected. */
export const RIR_RULE_MESSAGE = `RIR must be a number from ${RIR_MIN} to ${RIR_MAX} (decimals like 1.5 are allowed).`;

/** The same rule split for a toast, whose lines are truncated to one line each. */
export const RIR_RULE_TOAST = {title: `RIR must be ${RIR_MIN} to ${RIR_MAX}`, hint: 'Decimals like 1.5 are allowed.'};

/**
 * Parses a typed RIR — point or comma as decimal separator — into its stored
 * number. Returns `null` for anything that is not entirely a number or lies
 * outside 0–10. Kept to two decimals so float noise never reaches the store.
 */
export function parseRirInput(rawValue: string): number | null {
  const normalized = ensureFormat(rawValue).trim();
  if (normalized.length === 0) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < RIR_MIN || value > RIR_MAX) {
    return null;
  }
  return Math.round(value * 100) / 100;
}
