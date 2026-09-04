/**
 * GH-404: redux migration 12 — the single "Enable Dark Mode" switch became a
 * three-way Theme selector. An install that comes through the update must land
 * on the explicit mode it already had, never on 'system'.
 */

import {migrations} from '../../../configureStore';
import {resolveThemeModeSetting} from '../../../app/theme/themeMode';

describe('redux migration 12 (GH-404 theme mode)', () => {
  const migrate = (migrations as Record<number, (s: any) => any>)[12];

  it('maps a stored "Enable Dark Mode = off" onto Light', () => {
    const migrated = migrate({settings: {mode: 'light', palette: 'green'}});

    expect(migrated.settings).toEqual({mode: 'light', palette: 'green', themeMode: 'light'});
  });

  it('maps a stored "Enable Dark Mode = on" onto Dark', () => {
    const migrated = migrate({settings: {mode: 'dark', palette: 'blue'}});

    expect(migrated.settings).toEqual({mode: 'dark', palette: 'blue', themeMode: 'dark'});
  });

  it('never lands an existing install on system', () => {
    expect(migrate({settings: {mode: 'light'}}).settings.themeMode).not.toEqual('system');
    expect(migrate({settings: {mode: 'dark'}}).settings.themeMode).not.toEqual('system');
  });

  it('keeps a choice that has already been made in the new selector', () => {
    const migrated = migrate({settings: {mode: 'dark', themeMode: 'system'}});

    expect(migrated.settings).toEqual({mode: 'dark', themeMode: 'system'});
  });

  it('leaves the rest of the store untouched', () => {
    const migrated = migrate({
      settings: {mode: 'light'},
      exercises: {byId: {1: {id: 1}}, allIds: [1]},
    });

    expect(migrated.exercises).toEqual({byId: {1: {id: 1}}, allIds: [1]});
  });

  it('produces a state the runtime resolver reads back as the same mode', () => {
    // The migration and the resolver are two different code paths onto the same
    // decision; this pins them together.
    expect(resolveThemeModeSetting(migrate({settings: {mode: 'light'}}).settings)).toEqual('light');
    expect(resolveThemeModeSetting(migrate({settings: {mode: 'dark'}}).settings)).toEqual('dark');
  });
});
