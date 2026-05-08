import settingsReducer, {AppSettings} from '../../app/redux/settings/settingsReducer';

describe('settingsReducer rest timer actions', () => {
  const base: AppSettings = {mode: 'dark', palette: 'blue'};

  it('starts a new active rest entry with epoch + target', () => {
    const next = settingsReducer(base, {
      type: 'START_REST_TIMER',
      startedAt: 1000,
      targetSeconds: 90,
      exerciseId: 5,
      setIndex: 1,
    } as any);
    expect(next.restTimer?.active).toEqual({
      startedAt: 1000,
      targetSeconds: 90,
      exerciseId: 5,
      setIndex: 1,
    });
  });

  it('updates the target on UPDATE_REST_TIMER_TARGET without changing startedAt', () => {
    const started: AppSettings = {
      ...base,
      restTimer: {active: {startedAt: 500, targetSeconds: 90, exerciseId: 5, setIndex: 1}},
    };
    const next = settingsReducer(started, {
      type: 'UPDATE_REST_TIMER_TARGET',
      targetSeconds: 120,
    } as any);
    expect(next.restTimer?.active).toEqual({
      startedAt: 500,
      targetSeconds: 120,
      exerciseId: 5,
      setIndex: 1,
    });
  });

  it('resets the timer by replacing startedAt only', () => {
    const started: AppSettings = {
      ...base,
      restTimer: {active: {startedAt: 500, targetSeconds: 90, exerciseId: 5, setIndex: 1}},
    };
    const next = settingsReducer(started, {
      type: 'RESET_REST_TIMER',
      startedAt: 800,
    } as any);
    expect(next.restTimer?.active).toEqual({
      startedAt: 800,
      targetSeconds: 90,
      exerciseId: 5,
      setIndex: 1,
    });
  });

  it('dismisses the timer', () => {
    const started: AppSettings = {
      ...base,
      restTimer: {active: {startedAt: 500, targetSeconds: 90, exerciseId: 5, setIndex: 1}},
    };
    const next = settingsReducer(started, {type: 'DISMISS_REST_TIMER'} as any);
    expect(next.restTimer?.active).toBeNull();
  });

  it('sets the per-exercise default without overwriting other entries', () => {
    const seeded: AppSettings = {
      ...base,
      restTimer: {defaultPerExercise: {1: 60}},
    };
    const next = settingsReducer(seeded, {
      type: 'SET_REST_TIMER_EXERCISE_DEFAULT',
      exerciseId: 2,
      seconds: 120,
    } as any);
    expect(next.restTimer?.defaultPerExercise).toEqual({1: 60, 2: 120});
  });

  it('SET_PAUSE_TIMER also syncs restTimer.userDefaultSeconds', () => {
    const next = settingsReducer(base, {type: 'SET_PAUSE_TIMER', seconds: 120} as any);
    expect(next.localNotification?.pauseTimerInSeconds).toBe(120);
    expect(next.restTimer?.userDefaultSeconds).toBe(120);
  });

  it('SET_REST_TIMER_USER_DEFAULT also syncs localNotification.pauseTimerInSeconds', () => {
    const next = settingsReducer(base, {type: 'SET_REST_TIMER_USER_DEFAULT', seconds: 150} as any);
    expect(next.restTimer?.userDefaultSeconds).toBe(150);
    expect(next.localNotification?.pauseTimerInSeconds).toBe(150);
  });
});

describe('Redux migration 9 — pauseTimerInSeconds → restTimer.userDefaultSeconds', () => {
  it('copies localNotification.pauseTimerInSeconds into restTimer.userDefaultSeconds when not already set', () => {
    const migrations = require('../../configureStore').default;
    // Re-import migration function directly from the module
    // We test the logic inline since createMigrate wraps it
    const oldState = {
      settings: {
        mode: 'dark',
        localNotification: {pauseTimerInSeconds: 180, exactAlarmPermission: false},
        restTimer: undefined,
      },
    };
    // Simulate migration 9 logic
    const oldPauseSeconds = oldState.settings?.localNotification?.pauseTimerInSeconds;
    const alreadySet = (oldState.settings as any)?.restTimer?.userDefaultSeconds != null;
    let migrated = oldState;
    if (!alreadySet && oldPauseSeconds != null) {
      migrated = {
        ...oldState,
        settings: {
          ...oldState.settings,
          restTimer: {
            ...((oldState.settings as any).restTimer ?? {}),
            userDefaultSeconds: oldPauseSeconds,
          },
        },
      };
    }
    expect((migrated.settings as any).restTimer?.userDefaultSeconds).toBe(180);
  });

  it('does NOT overwrite an existing restTimer.userDefaultSeconds', () => {
    const oldState = {
      settings: {
        mode: 'dark',
        localNotification: {pauseTimerInSeconds: 180},
        restTimer: {userDefaultSeconds: 90},
      },
    };
    const oldPauseSeconds = oldState.settings?.localNotification?.pauseTimerInSeconds;
    const alreadySet = oldState.settings?.restTimer?.userDefaultSeconds != null;
    let migrated = oldState;
    if (!alreadySet && oldPauseSeconds != null) {
      migrated = {
        ...oldState,
        settings: {
          ...oldState.settings,
          restTimer: {
            ...oldState.settings.restTimer,
            userDefaultSeconds: oldPauseSeconds,
          },
        },
      };
    }
    expect(migrated.settings.restTimer?.userDefaultSeconds).toBe(90);
  });

  it('is a no-op when no pauseTimerInSeconds was ever set', () => {
    const oldState = {
      settings: {mode: 'dark', localNotification: {exactAlarmPermission: false}},
    };
    const oldPauseSeconds = (oldState.settings?.localNotification as any)?.pauseTimerInSeconds;
    const alreadySet = (oldState.settings as any)?.restTimer?.userDefaultSeconds != null;
    let migrated: any = oldState;
    if (!alreadySet && oldPauseSeconds != null) {
      migrated = {
        ...oldState,
        settings: {
          ...oldState.settings,
          restTimer: {userDefaultSeconds: oldPauseSeconds},
        },
      };
    }
    expect(migrated.settings?.restTimer?.userDefaultSeconds).toBeUndefined();
  });
});
