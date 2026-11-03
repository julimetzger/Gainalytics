import settingsReducer, {AppSettings} from '../../../app/redux/settings/settingsReducer';

// GH-674: Settings re-checks the exact-alarm permission on every open.
describe('settingsReducer — SET_EXACT_ALARM_PERMISSION', () => {
  const stored = {
    mode: 'dark',
    palette: 'blue',
    localNotification: {pauseTimerInSeconds: 90, exactAlarmPermission: true},
  } satisfies AppSettings;

  it('returns the same settings object when the permission did not change', () => {
    expect(settingsReducer(stored, {type: 'SET_EXACT_ALARM_PERMISSION', hasPermission: true})).toBe(stored);
  });

  it('stores a changed permission in a new settings object', () => {
    const next = settingsReducer(stored, {type: 'SET_EXACT_ALARM_PERMISSION', hasPermission: false});

    expect(next).not.toBe(stored);
    expect(next).toEqual({
      mode: 'dark',
      palette: 'blue',
      localNotification: {pauseTimerInSeconds: 90, exactAlarmPermission: false},
    });
  });

  it('stores the first answer on installs that never checked', () => {
    const fresh = {mode: 'dark'} satisfies AppSettings;

    expect(settingsReducer(fresh, {type: 'SET_EXACT_ALARM_PERMISSION', hasPermission: true})).toEqual({
      mode: 'dark',
      localNotification: {exactAlarmPermission: true},
    });
  });
});
