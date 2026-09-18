/**
 * GH-449: reading the answer out of an Anthropic Messages response.
 *
 * `content` is a LIST of blocks, and a text block is not guaranteed to be the first one — a
 * model that reasons before answering puts a `thinking` block in front of it, and an answer can
 * also arrive split across several text blocks. Reading `content[0].text` therefore yields
 * `undefined` for exactly those responses, which reaches the user as a Coach Insight card that
 * says "Generated just now" above nothing at all (observed on device with claude-opus-5).
 *
 * Collect every text block instead, in order.
 */
export function extractResponseText(data: unknown): string {
  const content = (data as {content?: unknown})?.content;
  if (!Array.isArray(content)) return '';

  return content
    .filter((block): block is {text: string} => {
      if (block === null || typeof block !== 'object') return false;
      const {type, text} = block as {type?: unknown; text?: unknown};
      if (typeof text !== 'string') return false;
      // `type` is absent only in hand-written fixtures; a real block always carries one.
      return type === undefined || type === 'text';
    })
    .map(block => block.text)
    .join('');
}
