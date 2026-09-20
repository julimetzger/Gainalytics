/**
 * GH-449: a response that hits `max_tokens` stops at an arbitrary token, which on screen reads
 * as a sentence breaking off mid-word ("... while hamst"). The API reports this as
 * `stop_reason: "max_tokens"`; nothing about the text itself says it is incomplete.
 *
 * These helpers turn such a response into something a reader can recognise as cut short.
 */

/** Shown next to a response the model could not finish within its token budget. */
export const TRUNCATION_NOTICE = 'Shortened — the answer hit the length limit.';

/** True when the API stopped the response because it ran out of output tokens. */
export function isTruncatedStopReason(stopReason: unknown): boolean {
  return stopReason === 'max_tokens';
}

/**
 * Cuts a truncated response back to its last complete sentence, or failing that to its last
 * whole word plus an ellipsis. Text that already ends on a sentence boundary is returned as-is.
 */
export function trimToCompleteText(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed === '') return '';

  // Already ends on punctuation (optionally closed by a quote/bracket/markdown marker).
  if (/[.!?…][*_"')\]]*$/.test(trimmed)) return trimmed;

  const lastSentenceEnd = Math.max(
    trimmed.lastIndexOf('. '),
    trimmed.lastIndexOf('! '),
    trimmed.lastIndexOf('? '),
    trimmed.lastIndexOf('.\n'),
    trimmed.lastIndexOf('!\n'),
    trimmed.lastIndexOf('?\n'),
  );
  if (lastSentenceEnd > 0) {
    return trimmed.slice(0, lastSentenceEnd + 1);
  }

  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > 0) {
    return `${trimmed.slice(0, lastSpace)}…`;
  }
  return `${trimmed}…`;
}
