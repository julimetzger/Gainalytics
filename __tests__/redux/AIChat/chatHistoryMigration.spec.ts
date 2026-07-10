/**
 * GH-293: redux migration 11 — the conversation that exists before the update
 * must be flagged for archival into the new chat history (the async file write
 * happens later in AIChatTab), and the history list must be initialised.
 */

import {migrations} from '../../../configureStore';

describe('redux migration 11 (GH-293 chat history)', () => {
  const migrate = (migrations as Record<number, (s: any) => any>)[11];

  it('flags a pre-existing conversation for legacy archival', () => {
    const oldState = {
      aiChat: {
        messages: [
          {role: 'user', content: 'old question'},
          {role: 'assistant', content: 'old answer'},
        ],
        isLoading: false,
        error: null,
        seedContextJson: null,
        contextRange: null,
      },
    };
    const migrated = migrate(oldState);
    expect(migrated.aiChat.history).toEqual([]);
    expect(migrated.aiChat.pendingLegacyArchive).toBe(true);
    // The messages themselves stay untouched — nothing is lost.
    expect(migrated.aiChat.messages).toHaveLength(2);
    expect(migrated.aiChat.messages[0].content).toBe('old question');
  });

  it('does not flag an empty conversation', () => {
    const migrated = migrate({
      aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
    });
    expect(migrated.aiChat.history).toEqual([]);
    expect(migrated.aiChat.pendingLegacyArchive).toBe(false);
  });

  it('handles a missing aiChat slice', () => {
    const migrated = migrate({});
    expect(migrated.aiChat.history).toEqual([]);
    expect(migrated.aiChat.pendingLegacyArchive).toBe(false);
    expect(migrated.aiChat.messages).toEqual([]);
  });
});
