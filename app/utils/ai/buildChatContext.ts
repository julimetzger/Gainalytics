/**
 * GH-391 — one place that decides what the chat is told, so the prompt the model
 * receives and the preview the user can open are literally built from the same
 * strings. Anything the preview does not show is not in the prompt either.
 */

export interface ChatContextParts {
  /** Finished trainings inside the selected time range (pre-existing context). */
  finishedJson: string | null;
  /** Planned sessions of the current and next micro, or null when switched off / nothing planned. */
  plannedJson: string | null;
  /** The single training the user picked as the subject, or null. */
  selectedJson: string | null;
}

export type ChatContextSectionKey = 'selected' | 'finished' | 'planned';

export interface ChatContextSection {
  key: ChatContextSectionKey;
  title: string;
  json: string;
}

const SECTION_TITLES: Record<ChatContextSectionKey, string> = {
  selected: 'Selected training (subject of this conversation; plan and, if trained, what was actually done)',
  finished: 'Finished trainings (JSON)',
  planned: 'Planned trainings (JSON; a value such as "8-12" is a planned range, not a fixed number)',
};

/** The sections that actually carry data, in the order the model sees them. */
export function chatContextSections(parts: ChatContextParts): ChatContextSection[] {
  const sections: ChatContextSection[] = [];
  const push = (key: ChatContextSectionKey, json: string | null) => {
    if (json) sections.push({key, title: SECTION_TITLES[key], json});
  };
  push('selected', parts.selectedJson);
  push('finished', parts.finishedJson);
  push('planned', parts.plannedJson);
  return sections;
}

/** The context block appended to the user's chat prompt, or null when there is no data at all. */
export function buildChatContextBlock(parts: ChatContextParts): string | null {
  const sections = chatContextSections(parts);
  if (sections.length === 0) return null;
  return sections.map(section => `${section.title}:\n\n${section.json}`).join('\n\n');
}

/**
 * The full system prompt. Without any context this is byte-identical to the bare
 * chat prompt, which is what the app sent before there was a planning half.
 */
export function buildChatSystemPrompt(basePrompt: string, parts: ChatContextParts): string {
  const block = buildChatContextBlock(parts);
  return block ? `${basePrompt}\n\nAnalysis context:\n\n${block}` : basePrompt;
}

/** Size of the context actually sent, in characters — the number the report quotes. */
export function chatContextSize(parts: ChatContextParts): number {
  return buildChatContextBlock(parts)?.length ?? 0;
}
