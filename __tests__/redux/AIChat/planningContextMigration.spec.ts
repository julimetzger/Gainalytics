/**
 * GH-391: redux migration 13. The persist config reconciles with `hardSet`, so
 * an existing install would come back without the two new aiChat keys — and
 * `includePlannedTrainings === undefined` would mean the planning is silently
 * off for everyone who already has the app.
 */

import {migrations} from '../../../configureStore';

describe('redux migration 13 (GH-391 planning context)', () => {
  const migrate = (migrations as Record<number, (s: any) => any>)[13];

  it('turns the planning on for an existing install', () => {
    const migrated = migrate({
      aiChat: {
        messages: [{role: 'user', content: 'hi'}],
        isLoading: false,
        error: null,
        seedContextJson: '{"sessions":[]}',
        contextRange: {startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-09-01T00:00:00.000Z'},
        history: [],
        pendingLegacyArchive: false,
      },
    });
    expect(migrated.aiChat.includePlannedTrainings).toBe(true);
    expect(migrated.aiChat.selectedTrainingId).toBeNull();
    // nothing that already existed is disturbed
    expect(migrated.aiChat.messages).toHaveLength(1);
    expect(migrated.aiChat.seedContextJson).toBe('{"sessions":[]}');
    expect(migrated.aiChat.contextRange.startDate).toBe('2026-08-01T00:00:00.000Z');
  });

  it('keeps an explicit off choice', () => {
    const migrated = migrate({aiChat: {includePlannedTrainings: false, selectedTrainingId: 7}});
    expect(migrated.aiChat.includePlannedTrainings).toBe(false);
    expect(migrated.aiChat.selectedTrainingId).toBe(7);
  });

  it('handles a missing aiChat slice', () => {
    const migrated = migrate({});
    expect(migrated.aiChat.includePlannedTrainings).toBe(true);
    expect(migrated.aiChat.selectedTrainingId).toBeNull();
  });

  it('leaves every other slice alone', () => {
    const migrated = migrate({settings: {themeMode: 'light'}, trainings: {byId: {}, allIds: []}});
    expect(migrated.settings).toEqual({themeMode: 'light'});
    expect(migrated.trainings).toEqual({byId: {}, allIds: []});
  });
});
