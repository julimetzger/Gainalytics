import {
  buildChatContextBlock,
  buildChatSystemPrompt,
  chatContextSections,
  chatContextSize,
  ChatContextParts,
} from '../../../app/utils/ai/buildChatContext';

const BASE = 'You are a powerlifting coach.';

const parts = (over: Partial<ChatContextParts> = {}): ChatContextParts => ({
  finishedJson: null,
  plannedJson: null,
  selectedJson: null,
  ...over,
});

describe('buildChatContext', () => {
  it('sends the bare prompt when there is no context at all', () => {
    expect(buildChatSystemPrompt(BASE, parts())).toBe(BASE);
    expect(buildChatContextBlock(parts())).toBeNull();
    expect(chatContextSize(parts())).toBe(0);
    expect(chatContextSections(parts())).toEqual([]);
  });

  it('keeps the finished-training context working on its own, exactly as before', () => {
    const prompt = buildChatSystemPrompt(BASE, parts({finishedJson: '{"sessions":[]}'}));
    expect(prompt).toContain('Analysis context');
    expect(prompt).toContain('Finished trainings');
    expect(prompt).toContain('{"sessions":[]}');
    expect(prompt).not.toContain('Planned trainings');
  });

  it('adds the planning section when planning is on', () => {
    const prompt = buildChatSystemPrompt(BASE, parts({finishedJson: '{"a":1}', plannedJson: '{"b":2}'}));
    expect(prompt).toContain('Planned trainings');
    expect(prompt).toContain('{"b":2}');
  });

  it('leaves the planning out completely when it is switched off', () => {
    const prompt = buildChatSystemPrompt(BASE, parts({finishedJson: '{"a":1}'}));
    expect(prompt).not.toContain('Planned trainings');
    expect(prompt).not.toContain('{"b":2}');
  });

  it('puts the subject first and the long finished history last', () => {
    const sections = chatContextSections(
      parts({finishedJson: '{"a":1}', plannedJson: '{"b":2}', selectedJson: '{"c":3}'}),
    );
    expect(sections.map(s => s.key)).toEqual(['selected', 'planned', 'finished']);
  });

  it('reports the size of exactly what is sent', () => {
    const p = parts({finishedJson: '{"a":1}', plannedJson: '{"b":2}'});
    expect(chatContextSize(p)).toBe(buildChatContextBlock(p)!.length);
    expect(chatContextSize(parts({finishedJson: '{"a":1}'}))).toBeLessThan(chatContextSize(p));
  });

  describe('GH-619 recovery section', () => {
    const RECOVERY = '[\n{"date":"2026-10-13","sleep_h":5,"steps":20113},\n{"date":"2026-10-14","sleep_h":7.5}\n]';

    it('is absent without recovery data, so the prompt is unchanged', () => {
      const p = parts({finishedJson: '{"a":1}', plannedJson: '{"b":2}'});
      expect(buildChatSystemPrompt(BASE, {...p, recoveryJson: null})).toBe(buildChatSystemPrompt(BASE, p));
      expect(chatContextSections({...p, recoveryJson: null}).map(s => s.key)).toEqual(['planned', 'finished']);
    });

    it('goes between the plan and the history, and the preview sections are exactly the prompt block', () => {
      const p = parts({finishedJson: '{"a":1}', plannedJson: '{"b":2}', selectedJson: '{"c":3}', recoveryJson: RECOVERY});
      const sections = chatContextSections(p);

      expect(sections.map(s => s.key)).toEqual(['selected', 'planned', 'recovery', 'finished']);
      expect(sections[2]).toEqual({
        key: 'recovery',
        title: 'Recovery (sleep and steps per day, JSON; sleep_h = the night ending on that date; a missing value means no data)',
        json: RECOVERY,
      });
      expect(buildChatSystemPrompt(BASE, p)).toBe(
        `${BASE}\n\nAnalysis context:\n\n${sections.map(s => `${s.title}:\n\n${s.json}`).join('\n\n')}`,
      );
      expect(chatContextSize(p)).toBe(buildChatContextBlock(p)!.length);
    });

    it('stays small: one line per day', () => {
      const [section] = chatContextSections(parts({recoveryJson: RECOVERY}));
      expect(section.json.split('\n')).toEqual(['[', '{"date":"2026-10-13","sleep_h":5,"steps":20113},', '{"date":"2026-10-14","sleep_h":7.5}', ']']);
    });
  });

  it('labels ranges so the model cannot read "8-12" as a single number', () => {
    const [section] = chatContextSections(parts({plannedJson: '{}'}));
    expect(section.title).toContain('8-12');
    expect(section.title).toContain('range');
  });
});
